const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SPIM = 'https://www.spimproject.com';
const OUT = path.join(__dirname, 'screenshots-spim-main');

async function capturePage(page, label, url, timeout = 20000) {
  console.log(`\n=== ${label}: ${url} ===`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  } catch (e) {
    console.log(`  WARN: ${e.message?.slice(0, 100)}`);
  }
  await page.waitForTimeout(4000);

  const dir = path.join(OUT, label.replace(/[\/\s:]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });

  await page.screenshot({ path: path.join(dir, 'viewport.png') });
  try {
    await page.screenshot({ path: path.join(dir, 'fullpage.png'), fullPage: true });
  } catch(e) {
    await page.screenshot({ path: path.join(dir, 'fullpage.png'), clip: { x: 0, y: 0, width: 1920, height: 5000 } });
  }

  const text = await page.evaluate(() => document.body.innerText).catch(() => '');
  fs.writeFileSync(path.join(dir, 'content.txt'), text || '');

  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.innerText.trim().slice(0, 100),
      href: a.href
    })).filter(l => l.href)
  ).catch(() => []);
  fs.writeFileSync(path.join(dir, 'links.json'), JSON.stringify(links, null, 2));

  const images = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src?.slice(0, 180),
      alt: img.alt
    }))
  ).catch(() => []);
  fs.writeFileSync(path.join(dir, 'images.json'), JSON.stringify(images, null, 2));

  console.log(`  text: ${(text?.length || 0)} chars, links: ${links.length}, images: ${images.length}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  try {
    await capturePage(page, 'virtual-tour', `${SPIM}/360-virtual-property-tour.html`);
    await capturePage(page, 'vr-ar', `${SPIM}/vr.html`);
    await capturePage(page, 'digiverse', `${SPIM}/digiverse.html`);
    await capturePage(page, 'immersion-center', `${SPIM}/real-estate-immersion-center.html`);
    await capturePage(page, 'contact', `${SPIM}/contact.html`);
    await capturePage(page, 'privacy', `${SPIM}/privacy-policy.html`);
    await capturePage(page, 'terms', `${SPIM}/terms-and-conditions.html`);
  } catch (err) {
    console.error('FATAL:', err.message);
  }

  await browser.close();
  console.log('\n========== REMAINING SPIM PAGES DONE ==========');
}

main();
