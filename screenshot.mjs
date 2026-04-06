import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('./server/node_modules/puppeteer');
import fs from 'fs';
import path from 'path';

const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';
const dir = './temporary screenshots';

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const existing = fs.readdirSync(dir).filter(f => f.startsWith('screenshot-'));
const nextNum = existing.length + 1;
const filename = label
  ? `screenshot-${nextNum}-${label}.png`
  : `screenshot-${nextNum}.png`;

const browser = await puppeteer.launch({
  executablePath: 'C:\\Users\\Rashid\\.cache\\puppeteer\\chrome\\win64-146.0.7680.153\\chrome-win64\\chrome.exe',
  headless: true,
  args: ['--no-sandbox']
});

const page = await browser.newPage();

const isMobile = label.includes('mobile');
if (isMobile) {
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
} else {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
}

await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 500));

// Scroll through entire page to trigger IntersectionObserver animations
await page.evaluate(async () => {
  const distance = 400;
  const delay = 100;
  const height = document.body.scrollHeight;
  for (let i = 0; i < height; i += distance) {
    window.scrollTo(0, i);
    await new Promise(r => setTimeout(r, delay));
  }
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 300));
});

await new Promise(r => setTimeout(r, 1000));

await page.screenshot({
  path: path.join(dir, filename),
  fullPage: true
});

console.log(`Screenshot saved: ${path.join(dir, filename)}`);
await browser.close();
