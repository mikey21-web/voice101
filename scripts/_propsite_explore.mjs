import { chromium } from 'playwright';
import fs from 'fs';

const EMAIL = 'udayakirantumma@gmail.com';
const PASS = '8074228036';
const OUT_DIR = 'c:/Users/TUMMA/OneDrive/Desktop/open code projects/virtual assisant/scripts/_propsite_dump';
fs.mkdirSync(OUT_DIR, { recursive: true });

const visited = new Set();
const report = [];

function safeName(url) {
  return url.replace(/[^a-z0-9]/gi, '_').slice(0, 120);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://propsite.in/', { waitUntil: 'networkidle' });

  // Try to find a login entry point
  const loginCandidates = ['text=/log ?in/i', 'text=/sign ?in/i', 'a[href*="login"]', 'a[href*="signin"]'];
  let clicked = false;
  for (const sel of loginCandidates) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      await el.click().catch(() => {});
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    await page.goto('https://propsite.in/login', { waitUntil: 'networkidle' }).catch(() => {});
  }
  await page.waitForTimeout(1500);

  // Fill login form
  const passSel = 'input[type="password"]';
  const emailSel = 'input:not([type="password"]):not([type="hidden"]):not([type="checkbox"])';
  await page.locator(emailSel).first().fill(EMAIL).catch(() => {});
  await page.locator(passSel).first().fill(PASS).catch(() => {});
  await page.screenshot({ path: `${OUT_DIR}/00_login_form.png` });

  const submitSel = 'button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")';
  await page.locator(submitSel).first().click().catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT_DIR}/01_after_login.png` });

  report.push(`URL after login attempt: ${page.url()}`);

  // BFS crawl within same origin, logged-in session
  const origin = 'https://propsite.in';
  const queue = [page.url()];
  let count = 0;
  const MAX_PAGES = 25;

  while (queue.length && count < MAX_PAGES) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    count++;

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    } catch (e) {
      report.push(`FAILED to load ${url}: ${e.message}`);
      continue;
    }
    await page.waitForTimeout(1000);

    const title = await page.title().catch(() => '');
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
    const name = safeName(url);
    fs.writeFileSync(`${OUT_DIR}/${name}.txt`, `URL: ${url}\nTITLE: ${title}\n\n${bodyText}`);
    await page.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: true }).catch(() => {});

    report.push(`\n=== ${url} ===\nTITLE: ${title}\n${bodyText.slice(0, 800)}`);

    // collect internal links
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]')).map(a => a.href)
    ).catch(() => []);

    for (const link of links) {
      if (link.startsWith(origin) && !visited.has(link) && !link.includes('#') && !link.match(/\.(png|jpg|pdf|svg|zip)$/i)) {
        queue.push(link.split('?')[0]);
      }
    }
  }

  fs.writeFileSync(`${OUT_DIR}/_report.txt`, report.join('\n'));
  await browser.close();
  console.log('DONE. Pages crawled:', count);
  console.log('Visited:', [...visited].join('\n'));
})();
