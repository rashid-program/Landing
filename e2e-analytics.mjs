/**
 * Проверка всего тракта статистики: браузер проходит страницу как посетитель,
 * затем сводка читается с сервера через /api/stats.
 * Временный скрипт проверки, в продакшене не нужен.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('./server/node_modules/puppeteer');

const BASE = 'http://127.0.0.1:3008';
const TOKEN = process.env.STATS_TOKEN || 'local-dev-token';
const CHROME =
  'C:\\Users\\Rashid\\.cache\\puppeteer\\chrome\\win64-146.0.7680.153\\chrome-win64\\chrome.exe';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });

/** Один визит: прокрутка по секциям и заданные действия. */
async function visit({ width, height, query, actions = [], stopAfter }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });

  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto(`${BASE}/${query || ''}`, { waitUntil: 'networkidle2' });

  const ids = await page.$$eval('section[id]', (nodes) => nodes.map((node) => node.id));
  const path = stopAfter ? ids.slice(0, ids.indexOf(stopAfter) + 1) : ids;

  for (const id of path) {
    await page.evaluate((sectionId) => {
      document.getElementById(sectionId)?.scrollIntoView({ block: 'center' });
    }, id);
    await new Promise((resolve) => setTimeout(resolve, 1700));
  }

  for (const selector of actions) {
    await page.evaluate((target) => document.querySelector(target)?.click(), selector);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  // Настоящий уход со страницы: срабатывает pagehide и досылка через sendBeacon.
  await page.goto('about:blank');
  await new Promise((resolve) => setTimeout(resolve, 500));
  await page.close();

  return errors;
}

const allErrors = [];

// Визит 1: пришёл из рекламы, дошёл до конца, написал в Telegram.
allErrors.push(...await visit({
  width: 1440, height: 900, query: '?utm_source=yandex&utm_medium=cpc',
  actions: ['[data-track-event="faq_open"]', '[data-track="cta-hero"]', '[data-track="telegram"]'],
}));

// Визит 2: телефон, ушёл на середине.
allErrors.push(...await visit({ width: 390, height: 844, stopAfter: 'method' }));

// Визит 3: планшет, долистал до отзывов и нажал «показать ещё».
allErrors.push(...await visit({
  width: 900, height: 1200, stopAfter: 'reviews',
  actions: ['[data-track="reviews-more"]'],
}));

await browser.close();

const response = await fetch(`${BASE}/api/stats?days=1`, {
  headers: { 'X-Stats-Token': TOKEN },
});
const { stats } = await response.json();

console.log('Визитов:', stats.visits);
console.log('Кликов в мессенджер:', stats.messengerClicks, '| конверсия:', stats.conversion + '%');
console.log('Среднее время:', stats.averageSeconds, 'с');

console.log('\nПрофиль просмотра:');
for (const section of stats.sections) {
  console.log(`  ${String(section.share).padStart(3)}%  ${section.id}`);
}

console.log('\nКнопки:');
for (const click of stats.clicks) console.log(`  ${click.count}×  ${click.label}`);

console.log('\nУстройства:', stats.viewports.map((v) => `${v.label}:${v.count}`).join(', '));
console.log('Источники:', stats.referrers.map((r) => `${r.label}:${r.count}`).join(', '));
console.log('Метки:', stats.campaigns.map((c) => `${c.label}:${c.count}`).join(', ') || '—');
console.log('\nОшибки страниц:', allErrors.length ? allErrors : 'нет');
