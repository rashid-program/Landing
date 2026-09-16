/**
 * Сбор обезличенной статистики поведения на странице.
 *
 * Данные остаются на собственном сервере: cookies не ставятся, постоянный
 * идентификатор посетителя не создаётся, персональные данные не собираются.
 * Идентификатор сессии случайный и живёт только до закрытия вкладки.
 * Запрос Do Not Track и Global Privacy Control отключает сбор полностью.
 */
(function initAnalytics() {
  'use strict';

  var ENDPOINT = '/api/events';
  var SESSION_KEY = 'mathx.sid';
  var FLUSH_INTERVAL_MS = 15000;
  var MAX_QUEUE = 40;
  var SECTION_DWELL_MS = 1000;
  var SCROLL_MARKS = [25, 50, 75, 100];

  var doNotTrack =
    navigator.doNotTrack === '1' ||
    window.doNotTrack === '1' ||
    navigator.globalPrivacyControl === true;

  if (doNotTrack || !('IntersectionObserver' in window)) {
    return;
  }

  var queue = [];
  var startedAt = Date.now();
  var flushTimer = null;
  var closed = false;

  function sessionId() {
    try {
      var existing = sessionStorage.getItem(SESSION_KEY);
      if (existing) return existing;
      var fresh =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()) + Math.random().toString(16).slice(2);
      sessionStorage.setItem(SESSION_KEY, fresh);
      return fresh;
    } catch (error) {
      // Приватный режим блокирует sessionStorage — считаем визит разовым.
      return 'no-storage';
    }
  }

  var sid = sessionId();

  /** Домен источника без пути и параметров — чтобы не утащить лишнее. */
  function referrerHost() {
    if (!document.referrer) return 'direct';
    try {
      var host = new URL(document.referrer).hostname;
      return host === location.hostname ? 'internal' : host;
    } catch (error) {
      return 'unknown';
    }
  }

  function campaign() {
    var params = new URLSearchParams(location.search);
    var source = params.get('utm_source');
    var medium = params.get('utm_medium');
    if (!source && !medium) return null;
    return [source, medium].filter(Boolean).join(' / ').slice(0, 80);
  }

  function viewport() {
    var width = window.innerWidth;
    if (width < 700) return 'mobile';
    if (width < 1100) return 'tablet';
    return 'desktop';
  }

  function push(name, target, value) {
    if (closed) return;
    queue.push({
      name: name,
      target: target || null,
      value: typeof value === 'number' ? value : null,
      at: Date.now() - startedAt,
    });
    if (queue.length >= MAX_QUEUE) flush();
  }

  function flush(useBeacon) {
    if (!queue.length) return;
    var payload = JSON.stringify({
      sid: sid,
      viewport: viewport(),
      referrer: referrerHost(),
      campaign: campaign(),
      events: queue.splice(0, queue.length),
    });

    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
      return;
    }

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(function () {
      // Статистика не должна ломать страницу, ошибку доставки игнорируем.
    });
  }

  // --- Просмотр страницы ---------------------------------------------------
  push('page_view', location.pathname);

  // --- Просмотр секций -----------------------------------------------------
  var dwellTimers = new Map();
  var seenSections = new Set();

  /**
   * Секция считается попавшей в поле зрения, если видно заметную её часть
   * либо она занимает половину экрана. Второе условие обязательно: у секции
   * выше двух с половиной экранов доля её собственной площади на экране
   * никогда не дотянет до порога, и такая секция иначе не засчитается вовсе.
   */
  function isSeenEnough(entry) {
    var visibleHeight = entry.intersectionRect.height;
    var sectionHeight = entry.boundingClientRect.height || 1;
    return visibleHeight / sectionHeight >= 0.4 || visibleHeight >= window.innerHeight * 0.5;
  }

  var sectionObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        var id = entry.target.id;
        if (!id || seenSections.has(id)) return;

        if (entry.isIntersecting && isSeenEnough(entry)) {
          // Наблюдатель срабатывает на каждом пороге прокрутки. Таймер на
          // секцию должен быть ровно один, иначе она засчитается несколько раз.
          if (dwellTimers.has(id)) return;

          // Секция засчитывается, только если её реально задержали на экране.
          dwellTimers.set(
            id,
            window.setTimeout(function () {
              dwellTimers.delete(id);
              if (seenSections.has(id)) return;
              seenSections.add(id);
              push('section_view', id);
              sectionObserver.unobserve(entry.target);
            }, SECTION_DWELL_MS),
          );
        } else if (dwellTimers.has(id)) {
          window.clearTimeout(dwellTimers.get(id));
          dwellTimers.delete(id);
        }
      });
    },
    // Наблюдаем плавно: решение принимает isSeenEnough, а не один порог.
    { threshold: [0, 0.1, 0.25, 0.5, 0.75] },
  );

  document.querySelectorAll('section[id]').forEach(function (section) {
    sectionObserver.observe(section);
  });

  // --- Глубина прокрутки ---------------------------------------------------
  var reachedMarks = new Set();
  var scrollScheduled = false;

  function measureScroll() {
    scrollScheduled = false;
    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    var percent = Math.round(((window.scrollY || doc.scrollTop) / scrollable) * 100);

    SCROLL_MARKS.forEach(function (mark) {
      if (percent >= mark && !reachedMarks.has(mark)) {
        reachedMarks.add(mark);
        push('scroll_depth', String(mark), mark);
      }
    });
  }

  window.addEventListener(
    'scroll',
    function () {
      if (scrollScheduled) return;
      scrollScheduled = true;
      window.requestAnimationFrame(measureScroll);
    },
    { passive: true },
  );

  // --- Клики ---------------------------------------------------------------
  document.addEventListener(
    'click',
    function (event) {
      var node = event.target.closest('[data-track]');
      if (!node) return;
      // Ловим клик до обработчика страницы, поэтому aria-expanded ещё в старом
      // состоянии: 'true' означает, что вопрос сейчас закроют — это не просмотр.
      if (node.dataset.trackEvent === 'faq_open' && node.getAttribute('aria-expanded') === 'true') {
        return;
      }
      push(node.dataset.trackEvent || 'click', node.dataset.track);
      // Уход во внешний мессенджер — успеваем отправить до выгрузки страницы.
      if (node.dataset.trackEvent === 'messenger_click') flush(true);
    },
    { capture: true },
  );

  // --- Отправка ------------------------------------------------------------
  flushTimer = window.setInterval(flush, FLUSH_INTERVAL_MS);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'hidden') return;
    push('session_end', null, Math.round((Date.now() - startedAt) / 1000));
    flush(true);
  });

  window.addEventListener('pagehide', function () {
    if (closed) return;
    closed = true;
    window.clearInterval(flushTimer);
    flush(true);
  });
})();
