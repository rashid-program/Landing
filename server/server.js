'use strict';

const crypto = require('crypto');
const compression = require('compression');
const express = require('express');
const fsp = require('fs/promises');
const path = require('path');
const analytics = require('./analytics-store');

const app = express();

const PORT = Number(process.env.PORT || 3008);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PUBLIC_ORIGIN = String(process.env.PUBLIC_ORIGIN || '').trim();

const PRIMARY_LEAD_WEBHOOK_URL = String(process.env.PRIMARY_LEAD_WEBHOOK_URL || '').trim();
const PRIMARY_DATA_REGION = String(process.env.PRIMARY_DATA_REGION || '').trim().toUpperCase();
const PRIMARY_STORAGE_CONFIRMED = process.env.PRIMARY_STORAGE_CONFIRMED === 'true';
const DATA_OPERATOR_ID = String(process.env.DATA_OPERATOR_ID || '').trim();
const CONSENT_VERSION = String(process.env.CONSENT_VERSION || '').trim();

const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TELEGRAM_CHAT_ID = String(process.env.TELEGRAM_CHAT_ID || '').trim();

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const leadRequestBuckets = new Map();

// Статистика шлёт батчи чаще заявок: отдельное окно и свой лимит.
const EVENT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const EVENT_RATE_LIMIT_MAX_REQUESTS = 30;
const eventRequestBuckets = new Map();

// Панель статистики закрыта токеном. Пока он не задан, /stats отдаёт 404.
const STATS_TOKEN = String(process.env.STATS_TOKEN || '').trim();

const ALLOWED_APPLICANT_TYPES = new Set(['parent', 'adult-student']);
const ALLOWED_GRADES = new Set(['6', '7', '8', '9', '10', '11', 'other']);
const ALLOWED_GOALS = new Set(['oge', 'ege-profile', 'ege-basic', 'school', 'olympiad', 'other']);
const ALLOWED_CONTACT_METHODS = new Set(['telegram', 'whatsapp', 'phone']);

app.disable('x-powered-by');
app.use(compression());

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Origin-Agent-Cluster', '?1');

  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self'",
      "font-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      IS_PRODUCTION ? 'upgrade-insecure-requests' : '',
    ]
      .filter(Boolean)
      .join('; '),
  );

  next();
});

app.use(express.json({ limit: '16kb', type: 'application/json' }));

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizePhone(value) {
  const raw = cleanText(value, 40);
  return {
    raw,
    digits: raw.replace(/\D/g, ''),
  };
}

function validateLead(body) {
  const applicantType = cleanText(body.applicantType, 30);
  const name = cleanText(body.name, 80);
  const phone = normalizePhone(body.phone);
  const grade = cleanText(body.grade, 20);
  const goal = cleanText(body.goal, 30);
  const contactMethod = cleanText(body.contactMethod, 20);
  const website = cleanText(body.website, 200);
  const consent = body.consent === true;
  const errors = {};

  if (website) {
    errors.form = 'Заявка не прошла автоматическую проверку.';
  }

  if (!ALLOWED_APPLICANT_TYPES.has(applicantType)) {
    errors.applicantType = 'Укажите, кто оставляет заявку.';
  }

  if (name.length < 2) {
    errors.name = 'Укажите имя — минимум 2 символа.';
  }

  if (phone.digits.length < 10 || phone.digits.length > 15) {
    errors.phone = 'Проверьте номер телефона.';
  }

  if (grade && !ALLOWED_GRADES.has(grade)) {
    errors.grade = 'Выберите класс из списка.';
  }

  if (goal && !ALLOWED_GOALS.has(goal)) {
    errors.goal = 'Выберите цель из списка.';
  }

  if (contactMethod && !ALLOWED_CONTACT_METHODS.has(contactMethod)) {
    errors.contactMethod = 'Выберите способ связи из списка.';
  }

  if (!consent) {
    errors.consent = 'Нужно отдельное согласие на обработку персональных данных.';
  }

  return {
    errors,
    lead: {
      applicantType,
      name,
      phone: phone.raw,
      grade: grade || 'не указан',
      goal: goal || 'не указана',
      contactMethod: contactMethod || 'не указан',
    },
  };
}

function isRateLimited(ip) {
  const now = Date.now();
  const bucket = leadRequestBuckets.get(ip);

  if (!bucket || now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) {
    leadRequestBuckets.set(ip, { startedAt: now, count: 1 });
    return false;
  }

  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

function clientIp(req) {
  return req.ip || 'unknown';
}

function isEventRateLimited(ip) {
  const now = Date.now();
  const bucket = eventRequestBuckets.get(ip);

  if (!bucket || now - bucket.startedAt >= EVENT_RATE_LIMIT_WINDOW_MS) {
    eventRequestBuckets.set(ip, { startedAt: now, count: 1 });
    return false;
  }

  bucket.count += 1;
  return bucket.count > EVENT_RATE_LIMIT_MAX_REQUESTS;
}

/**
 * Доступ к данным статистики. Токен принимается только заголовком: в
 * query-строке он осел бы в логах сервера, истории браузера и в любой
 * пересланной ссылке. Сравнение постоянное по времени, чтобы токен нельзя
 * было подобрать побайтно.
 */
function isStatsAuthorized(req) {
  if (!STATS_TOKEN) return false;

  const provided = String(req.get('x-stats-token') || '');
  if (provided.length !== STATS_TOKEN.length) return false;

  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(STATS_TOKEN));
}

function pruneRateLimitBuckets() {
  const now = Date.now();

  for (const [ip, bucket] of leadRequestBuckets.entries()) {
    if (now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) {
      leadRequestBuckets.delete(ip);
    }
  }

  for (const [ip, bucket] of eventRequestBuckets.entries()) {
    if (now - bucket.startedAt >= EVENT_RATE_LIMIT_WINDOW_MS) {
      eventRequestBuckets.delete(ip);
    }
  }
}

const bucketCleanupTimer = setInterval(pruneRateLimitBuckets, RATE_LIMIT_WINDOW_MS);
bucketCleanupTimer.unref();

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isAllowedPrimaryEndpoint(value) {
  try {
    const endpoint = new URL(value);
    if (endpoint.protocol === 'https:') return true;

    return Boolean(
      !IS_PRODUCTION &&
        endpoint.protocol === 'http:' &&
        ['127.0.0.1', 'localhost', '::1'].includes(endpoint.hostname),
    );
  } catch {
    return false;
  }
}

function isPrimaryStorageConfigured() {
  return Boolean(
    isAllowedPrimaryEndpoint(PRIMARY_LEAD_WEBHOOK_URL) &&
      PRIMARY_DATA_REGION === 'RU' &&
      PRIMARY_STORAGE_CONFIRMED &&
      DATA_OPERATOR_ID &&
      CONSENT_VERSION &&
      (!IS_PRODUCTION || isHttpsUrl(PUBLIC_ORIGIN)),
  );
}

function isTelegramNotificationConfigured() {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
}

function isAllowedOrigin(req) {
  const requestOrigin = req.get('origin');
  if (!requestOrigin) return !IS_PRODUCTION;

  try {
    const expectedOrigin = PUBLIC_ORIGIN || `${req.protocol}://${req.get('host')}`;
    return new URL(requestOrigin).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}

async function deliverToPrimaryStorage(lead, consentEvidence) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  timeout.unref();

  const headers = {
    'Content-Type': 'application/json',
  };

  if (process.env.PRIMARY_LEAD_WEBHOOK_TOKEN) {
    headers.Authorization = `Bearer ${process.env.PRIMARY_LEAD_WEBHOOK_TOKEN}`;
  }

  try {
    const response = await fetch(PRIMARY_LEAD_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        source: 'mathx-landing',
        operatorId: DATA_OPERATOR_ID,
        lead,
        consentEvidence,
      }),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.persisted !== true) {
      throw new Error(`Primary storage did not confirm persistence (${response.status})`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function notifyTelegram(requestId) {
  if (!isTelegramNotificationConfigured()) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  timeout.unref();

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: `Новая заявка MathX\nID: ${requestId}\nОткройте российскую CRM.`,
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Telegram notification failed (${response.status})`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/api/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    leadCollectionReady: isPrimaryStorageConfigured(),
  });
});

app.post('/api/events', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ ok: false });
  }

  if (isEventRateLimited(clientIp(req))) {
    return res.status(429).json({ ok: false });
  }

  try {
    await analytics.recordBatch(req.body);
  } catch {
    // Сбор статистики не влияет на работу сайта: молча проглатываем сбой.
  }

  // Ответ без тела: браузеру от него ничего не нужно, а sendBeacon его не читает.
  return res.status(204).end();
});

app.get('/api/stats', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!isStatsAuthorized(req)) {
    return res.status(404).json({ ok: false, message: 'API endpoint not found.' });
  }

  const requestedDays = Number.parseInt(String(req.query.days || '7'), 10);
  const days = Number.isFinite(requestedDays) ? Math.min(Math.max(requestedDays, 1), 90) : 7;

  try {
    return res.json({ ok: true, stats: await analytics.readStats(days) });
  } catch {
    return res.status(500).json({ ok: false, message: 'Не удалось прочитать статистику.' });
  }
});

// Сама страница панели данных не содержит: она только просит токен и ходит за
// сводкой в /api/stats. Поэтому отдаётся без проверки — иначе токен пришлось бы
// передавать в адресе страницы, а там он попадает в логи и историю браузера.
app.get('/stats', async (req, res) => {
  // Панель держит свой скрипт внутри страницы, поэтому общий CSP со
  // `script-src 'self'` для неё заменяется на разовый nonce.
  const nonce = crypto.randomBytes(16).toString('base64');

  try {
    const template = await fsp.readFile(path.join(__dirname, 'stats.html'), 'utf8');

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "base-uri 'self'",
        "connect-src 'self'",
        "form-action 'none'",
        "frame-ancestors 'none'",
        "img-src 'self' data:",
        "object-src 'none'",
        `script-src 'nonce-${nonce}'`,
        "style-src 'self' 'unsafe-inline'",
      ].join('; '),
    );

    return res.type('html').send(template.replace('__NONCE__', nonce));
  } catch {
    return res.status(500).type('text/plain').send('Панель статистики недоступна.');
  }
});

app.post('/api/leads', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({
      ok: false,
      message: 'Источник запроса не разрешён.',
    });
  }

  if (isRateLimited(req.ip)) {
    return res.status(429).json({
      ok: false,
      message: 'Слишком много попыток. Подождите несколько минут.',
    });
  }

  const { errors, lead } = validateLead(req.body || {});

  if (Object.keys(errors).length > 0) {
    return res.status(422).json({
      ok: false,
      message: 'Проверьте заполненные поля.',
      errors,
    });
  }

  if (!isPrimaryStorageConfigured()) {
    return res.status(503).json({
      ok: false,
      message: 'Онлайн-заявка пока не включена: настраивается российский защищённый контур.',
    });
  }

  const requestId = crypto.randomUUID();
  const consentEvidence = {
    accepted: true,
    documentVersion: CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
    requestId,
    sourcePath: '/#contact',
    ip: req.ip,
    userAgent: cleanText(req.get('user-agent') || '', 300),
  };

  try {
    await deliverToPrimaryStorage(lead, consentEvidence);

    notifyTelegram(requestId).catch((error) => {
      console.error(`[lead:${requestId}] anonymized notification failed: ${error.message}`);
    });

    return res.status(201).json({
      ok: true,
      requestId,
      message: 'Заявка сохранена. Я свяжусь с вами в согласованный срок.',
    });
  } catch (error) {
    console.error(`[lead:${requestId}] primary delivery failed: ${error.message}`);
    return res.status(502).json({
      ok: false,
      message: 'Не удалось безопасно сохранить заявку. Попробуйте ещё раз позже.',
    });
  }
});

app.use(
  express.static(PUBLIC_DIR, {
    dotfiles: 'deny',
    etag: true,
    fallthrough: true,
    index: false,
    maxAge: IS_PRODUCTION ? '1h' : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }),
);

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use('/api', (req, res) => {
  res.status(404).json({
    ok: false,
    message: 'API endpoint not found.',
  });
});

app.use((req, res) => {
  res.status(404).type('text/plain').send('Страница не найдена.');
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      ok: false,
      message: 'Некорректный JSON.',
    });
  }

  console.error(`Unhandled server error: ${error.message}`);
  return res.status(500).json({
    ok: false,
    message: 'Внутренняя ошибка сервера.',
  });
});

app.listen(PORT, HOST, () => {
  console.log(`MathX sandbox running at http://${HOST}:${PORT}`);
  console.log(`Privacy-first lead collection: ${isPrimaryStorageConfigured() ? 'ready' : 'disabled'}`);
});
