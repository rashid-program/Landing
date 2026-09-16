/** Скриншот страницы на ширине телефона. Временный скрипт проверки. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('./server/node_modules/puppeteer');

const url = process.argv[2];
const out = `./temporary screenshots/${process.argv[3] || 'mobile'}.png`;

const browser = await puppeteer.launch({
  executablePath:
    'C:\\Users\\Rashid\\.cache\\puppeteer\\chrome\\win64-146.0.7680.153\\chrome-win64\\chrome.exe',
  headless: 'new',
});

const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle2' });
await new Promise((resolve) => setTimeout(resolve, 800));
await page.screenshot({ path: out, fullPage: true });
await browser.close();

console.log('Saved:', out);
