import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('./server/node_modules/puppeteer');
import fs from 'fs';
import path from 'path';

const url = process.argv[2] || 'http://localhost:3007';
const selector = process.argv[3] || '#testimonials';
const dir = './temporary screenshots';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const existing = fs.readdirSync(dir).filter(f => f.startsWith('screenshot-'));
let n = existing.length;

const browser = await puppeteer.launch({
  executablePath: 'C:\\Users\\Rashid\\.cache\\puppeteer\\chrome\\win64-146.0.7680.153\\chrome-win64\\chrome.exe',
  headless: true,
  args: ['--no-sandbox']
});

async function shoot(label, vp) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 400));
  // scroll to trigger reveal animations
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let i = 0; i < h; i += 400) { window.scrollTo(0, i); await new Promise(r => setTimeout(r, 80)); }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 300));
  });
  await page.evaluate(sel => document.querySelector(sel).scrollIntoView(), selector);
  await new Promise(r => setTimeout(r, 800));
  const el = await page.$(selector);
  n += 1;
  const filename = `screenshot-${n}-${label}.png`;
  await el.screenshot({ path: path.join(dir, filename) });
  console.log('Saved:', filename);
  await page.close();
}

await shoot('reviews-desktop', { width: 1440, height: 900, deviceScaleFactor: 1 });
await shoot('reviews-mobile', { width: 390, height: 844, deviceScaleFactor: 2 });

await browser.close();
