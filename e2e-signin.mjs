/** Проверка входа в панель статистики. Временный скрипт проверки. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('./server/node_modules/puppeteer');

const browser = await puppeteer.launch({
  executablePath:
    'C:\\Users\\Rashid\\.cache\\puppeteer\\chrome\\win64-146.0.7680.153\\chrome-win64\\chrome.exe',
  headless: 'new',
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

// Проверяем, что токен не утекает в адрес запроса.
const urlsWithToken = [];
page.on('request', (request) => {
  if (/token=/i.test(request.url())) urlsWithToken.push(request.url());
});

await page.goto('http://127.0.0.1:3008/stats', { waitUntil: 'networkidle2' });

const beforeLogin = await page.evaluate(() => ({
  hasInput: !!document.getElementById('token-input'),
  hasNumbers: !!document.querySelector('.summary'),
}));
console.log('Экран входа показан:', beforeLogin.hasInput);
console.log('Данные до входа скрыты:', !beforeLogin.hasNumbers);

await page.screenshot({ path: './temporary screenshots/stats-signin.png' });

// Неверный токен
await page.type('#token-input', 'definitely-wrong');
await page.click('#token-submit');
await new Promise((r) => setTimeout(r, 900));
const afterWrong = await page.evaluate(() => document.querySelector('.error')?.textContent || '');
console.log('Ошибка при неверном токене:', afterWrong ? 'показана' : 'НЕ показана');

// Верный токен
await page.evaluate(() => { document.getElementById('token-input').value = ''; });
await page.type('#token-input', 'local-dev-token');
await page.click('#token-submit');
await new Promise((r) => setTimeout(r, 1200));

const afterLogin = await page.evaluate(() => ({
  visits: document.querySelector('.summary b')?.textContent || '—',
  sections: document.querySelectorAll('.profile .row').length,
  url: location.href,
}));
console.log('После входа — визитов:', afterLogin.visits, '| строк профиля:', afterLogin.sections);
console.log('Адрес страницы:', afterLogin.url);
console.log('Запросы с токеном в адресе:', urlsWithToken.length ? urlsWithToken : 'нет');

await page.screenshot({ path: './temporary screenshots/stats-after-signin.png', fullPage: true });

// Перезагрузка: токен должен помниться до закрытия вкладки.
await page.reload({ waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 900));
const afterReload = await page.evaluate(() => !!document.querySelector('.summary'));
console.log('После перезагрузки данные видны без повторного ввода:', afterReload);

await browser.close();
