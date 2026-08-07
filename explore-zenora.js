const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://zenvistas.spimproject.com';
const OUT = path.join(__dirname, 'screenshots-zenora');

async function capturePage(page, label, url, timeout = 30000) {
  console.log(`\n=== ${label}: ${url} ===`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  } catch (e) {
    console.log(`  WARN: navigation timeout/error: ${e.message?.slice(0, 100)}`);
  }
  await page.waitForTimeout(4000);
  
  const dir = path.join(OUT, label.replace(/[\/\s:]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });

  await page.screenshot({ path: path.join(dir, 'viewport.png') });
  
  // Try full page (might fail on heavy canvas pages)
  try {
    await page.screenshot({ path: path.join(dir, 'fullpage.png'), fullPage: true });
  } catch(e) {
    console.log('  fullPage screenshot failed, trying clip');
    await page.screenshot({ path: path.join(dir, 'fullpage.png'), clip: { x: 0, y: 0, width: 1920, height: 3000 } });
  }

  const text = await page.evaluate(() => document.body.innerText).catch(() => '(failed)');
  fs.writeFileSync(path.join(dir, 'content.txt'), text || '');

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.innerText.trim().slice(0, 100),
      href: a.href
    })).filter(l => l.href);
  }).catch(() => []);
  fs.writeFileSync(path.join(dir, 'links.json'), JSON.stringify(links, null, 2));

  const images = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src?.slice(0, 150),
      alt: img.alt
    }));
  }).catch(() => []);
  fs.writeFileSync(path.join(dir, 'images.json'), JSON.stringify(images, null, 2));

  const headings = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
      level: h.tagName,
      text: h.innerText.trim()
    }));
  }).catch(() => []);
  fs.writeFileSync(path.join(dir, 'headings.json'), JSON.stringify(headings, null, 2));

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, [role="button"], [class*="btn"]')).map(b => ({
      text: b.innerText.trim().slice(0, 80),
      tag: b.tagName,
      type: b.type,
      class: b.className?.slice(0, 100)
    }));
  }).catch(() => []);
  fs.writeFileSync(path.join(dir, 'buttons.json'), JSON.stringify(buttons, null, 2));

  console.log(`  text: ${(text?.length || 0)} chars, links: ${links.length}, images: ${images.length}, buttons: ${buttons.length}`);
  return { dir, text, links, images };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  try {
    // HOME PAGE - detailed exploration
    await capturePage(page, 'home', BASE);
    
    // Click menu items if present
    const menuBtns = await page.$$('button:has-text("Menu"), [class*="menu"] button, .hamburger, [class*="toggle"]');
    console.log(`  menu buttons found: ${menuBtns.length}`);

    // WEBVERSE PAGE
    await capturePage(page, 'webverse', `${BASE}/webverse.html`);
    
    // Try interacting with filters on webverse
    const filterButtons = await page.$$('button:has-text("Filter"), [class*="filter"]');
    console.log(`  filter buttons on webverse: ${filterButtons.length}`);

    // MAPS / ZONE IQ PAGE
    await capturePage(page, 'maps', `${BASE}/maps.html`);

    // ABOUT PAGE
    await capturePage(page, 'about', `${BASE}/about.html`);

    // GALLERY PAGE
    await capturePage(page, 'gallery', `${BASE}/gallery.html`);

    // BROCHURE PAGE
    await capturePage(page, 'brochure', `${BASE}/brochure.html`);

    // CONTACT PAGE
    await capturePage(page, 'contact', `${BASE}/contact.html`);

    // EXTERIOR 360 - shorter timeout 
    await capturePage(page, 'exterior', `${BASE}/exterior.html`, 15000);

    // INTERIOR 360 - shorter timeout, might be a 3D canvas
    await capturePage(page, 'interior', `${BASE}/interior.html`, 15000);

  } catch (err) {
    console.error('FATAL:', err.message);
  }

  await browser.close();
  console.log('\n========== DONE ==========');
}

main();
