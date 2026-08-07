const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const MAIN = 'https://nikhilaconstructions.com/royal-pavilion';
const WEBSITE = 'https://ncd-eight.vercel.app';
const SPIM = 'https://www.spimproject.com';
const OUT = path.join(__dirname, 'screenshots-royal-pavilion');

async function capturePage(page, label, url, timeout = 25000) {
  console.log(`\n=== ${label}: ${url} ===`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  } catch (e) {
    console.log(`  WARN: ${e.message?.slice(0, 100)}`);
  }
  await page.waitForTimeout(5000);

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

  const headings = await page.evaluate(() =>
    Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
      level: h.tagName,
      text: h.innerText.trim()
    }))
  ).catch(() => []);
  fs.writeFileSync(path.join(dir, 'headings.json'), JSON.stringify(headings, null, 2));

  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, [role="button"], [class*="btn"]')).map(b => ({
      text: b.innerText.trim().slice(0, 80),
      class: b.className?.slice(0, 100)
    }))
  ).catch(() => []);
  fs.writeFileSync(path.join(dir, 'buttons.json'), JSON.stringify(buttons, null, 2));

  console.log(`  text: ${(text?.length || 0)} chars, links: ${links.length}, images: ${images.length}, buttons: ${buttons.length}`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  try {
    // NCD Royal Pavilion main page
    await capturePage(page, 'main-site', MAIN);

    // Vercel website - scroll through every section
    await capturePage(page, 'vercel-home', WEBSITE);
    
    // Scroll through entire page taking section screenshots
    const sections = await page.evaluate(() => {
      const divs = [];
      document.querySelectorAll('section, [class*="section"], [id], div[class*="container"], div[class*="wrapper"]').forEach(s => {
        const r = s.getBoundingClientRect();
        if (r.width > 0 && r.height > 100 && s.innerText.trim().length > 50) {
          divs.push({
            id: s.id || s.className?.slice(0, 50),
            text: s.innerText.trim().slice(0, 200),
            top: r.top, height: r.height
          });
        }
      });
      return divs;
    }).catch(() => []);
    
    const secDir = path.join(OUT, 'vercel-home');
    fs.mkdirSync(secDir, { recursive: true });
    fs.writeFileSync(path.join(secDir, 'sections.json'), JSON.stringify(sections, null, 2));
    console.log(`  sections on page: ${sections.length}`);

    // Screenshot individual sections
    for (let i = 0; i < Math.min(sections.length, 50); i++) {
      const s = sections[i];
      if (s.height > 100) {
        try {
          await page.screenshot({
            path: path.join(secDir, `section-${i}.png`),
            clip: { x: 0, y: Math.max(0, s.top), width: 1920, height: Math.min(s.height, 3000) }
          });
        } catch(e) {}
      }
    }

    // Try sub-pages
    for (const sub of ['about', 'gallery', 'plans', 'location', 'contact']) {
      await capturePage(page, `vercel-${sub}`, `${WEBSITE}/${sub}`, 15000);
    }

    // NCD main site
    await capturePage(page, 'ncd-main', 'https://nikhilaconstructions.com/', 15000);

  } catch (err) {
    console.error('FATAL:', err.message);
  }

  await browser.close();
  console.log('\n========== ROYAL PAVILION DONE ==========');
}

main();
