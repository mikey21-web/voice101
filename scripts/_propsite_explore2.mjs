import { chromium } from 'playwright';
import fs from 'fs';

const EMAIL = 'udayakirantumma@gmail.com';
const PASS = '8074228036';
const OUT = 'c:/Users/TUMMA/OneDrive/Desktop/open code projects/virtual assisant/scripts/_propsite_dump2';
fs.mkdirSync(OUT, { recursive: true });

// Routes found in the JS bundle that the first crawl never linked to.
// Admin route deliberately excluded, not our system to poke at.
const ROUTES = [
  '/co-agent',
  '/properties',
  '/dashboard/leads',
  '/dashboard/analytics',
  '/dashboard/projects',
  '/join-agency',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const apiCalls = [];
  page.on('response', async r => {
    const u = r.url();
    if (u.includes('supabase.co') && !u.includes('.js')) {
      apiCalls.push(`${r.status()} ${r.request().method()} ${u.slice(0, 220)}`);
    }
  });

  await page.goto('https://propsite.in/login', { waitUntil: 'networkidle' });
  await page.locator('input:not([type="password"]):not([type="hidden"])').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();
  await page.waitForTimeout(4000);

  const out = [];
  for (const route of ROUTES) {
    const url = `https://propsite.in${route}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    } catch { /* SPA may not settle, screenshot anyway */ }
    await page.waitForTimeout(2500);
    const text = await page.evaluate(() => document.body.innerText).catch(() => '');
    const name = route.replace(/[^a-z0-9]/gi, '_');
    fs.writeFileSync(`${OUT}/${name}.txt`, `URL: ${url}\nLANDED: ${page.url()}\n\n${text}`);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }).catch(() => {});
    out.push(`\n=== ${route} (landed: ${page.url()}) ===\n${text.slice(0, 1200)}`);
  }

  fs.writeFileSync(`${OUT}/_api_calls.txt`, [...new Set(apiCalls)].join('\n'));
  fs.writeFileSync(`${OUT}/_report.txt`, out.join('\n'));
  await browser.close();
  console.log(out.join('\n'));
})();
