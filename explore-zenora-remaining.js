const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://zenvistas.spimproject.com';
const DEEP = path.join(__dirname, 'screenshots-zenora', 'deep-dive');
fs.mkdirSync(DEEP, { recursive: true });

const log = [];
function note(msg) { console.log(msg); log.push(msg); }

async function snap(page, name) {
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(DEEP, `${name}.png`) });
}

async function clickF(page, selector, name) {
  const el = await page.$(selector);
  if (el) {
    try { await el.click({ force: true }); await page.waitForTimeout(1500); await snap(page, name); return true; } catch(e) { note(`  ${name}: ${e.message?.slice(0,60)}`); }
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('dialog', async d => { try { await d.dismiss(); } catch(e) {} });

  try {
    // === WEBVERSE remaining ===
    note('=== WEBVERSE remaining ===');
    await page.goto(`${BASE}/webverse.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(4000);

    await clickF(page, 'li:has-text("NIGHT")', '09b-webverse-night');
    await clickF(page, 'li:has-text("NIGHT")', '09c-webverse-day');

    for (const tab of ['Aerial View', 'Community', 'Interior', 'Google Maps', 'Zone IQ']) {
      await clickF(page, `li.tab-btn:has-text("${tab}")`, `09d-tab-${tab.replace(/\s/g, '')}`);
      if (tab === 'Google Maps' || tab === 'Zone IQ') await page.waitForTimeout(3000);
    }

    await clickF(page, 'button:has-text("Explore")', '09e-webverse-explore');
    await clickF(page, 'a[href*="whatsapp"], a[href*="wa.me"]', '09f-webverse-whatsapp');

    // === HOME ===
    note('=== HOME ===');
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(4000);
    await snap(page, 'home-loaded');
    await clickF(page, 'button:has-text("Menu")', 'home-menu');
    await clickF(page, 'button:has-text("×")', 'home-menu-closed');
    for (const tab of ['Aerial View', 'Community', 'Interior', 'Google Maps', 'Zone IQ']) {
      await clickF(page, `li:has-text("${tab}")`, `home-${tab.replace(/\s/g, '')}`);
      if (tab === 'Google Maps' || tab === 'Zone IQ') await page.waitForTimeout(2000);
    }
    await clickF(page, 'button:has-text("Full")', 'home-fullscreen');
    await clickF(page, 'a[href*="wa.me"]', 'home-whatsapp');

    // === MAPS ===
    note('=== MAPS ===');
    await page.goto(`${BASE}/maps.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);
    await snap(page, 'maps-loaded');
    for (const f of ['Travel', 'Destination', 'Education', 'Work', 'Shopping', 'Hospitals']) {
      await clickF(page, `button:has-text("${f}"), li:has-text("${f}")`, `maps-${f}`);
    }
    for (const tab of ['Aerial View', 'Exterior', 'Interior', 'Google Maps', 'Zone IQ']) {
      await clickF(page, `li:has-text("${tab}")`, `maps-tab-${tab.replace(/\s/g, '')}`);
    }

    // === ABOUT ===
    note('=== ABOUT ===');
    await page.goto(`${BASE}/about.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await snap(page, 'about-loaded');

    // === GALLERY ===
    note('=== GALLERY ===');
    await page.goto(`${BASE}/gallery.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await snap(page, 'gallery-loaded');
    await clickF(page, 'button:has-text("Next")', 'gallery-next');
    await clickF(page, 'button:has-text("Previous")', 'gallery-prev');
    await clickF(page, 'button:has-text("View All")', 'gallery-viewall');
    await clickF(page, 'button:has-text("Amenities")', 'gallery-amenities');

    // === CONTACT ===
    note('=== CONTACT ===');
    await page.goto(`${BASE}/contact.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await snap(page, 'contact-loaded');
    const form = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, textarea')).map(i => ({
        name: i.name, type: i.type, placeholder: i.placeholder, id: i.id
      }));
    }).catch(() => []);
    fs.writeFileSync(path.join(DEEP, 'contact-fields.json'), JSON.stringify(form, null, 2));
    note(`Form fields: ${form.length}`);

    // === BROCHURE ===
    note('=== BROCHURE ===');
    await page.goto(`${BASE}/brochure.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    await snap(page, 'brochure-loaded');

    // === EXTERIOR 360 ===
    note('=== EXTERIOR 360 ===');
    try {
      await page.goto(`${BASE}/exterior.html`, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await page.waitForTimeout(4000);
      await snap(page, 'exterior-360');
      note('Exterior 360 captured');
    } catch(e) {
      await snap(page, 'exterior-360-timeout');
      note(`Exterior timeout: ${e.message?.slice(0,60)}`);
    }

    // === INTERIOR 360 ===
    note('=== INTERIOR 360 ===');
    try {
      await page.goto(`${BASE}/interior.html`, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await page.waitForTimeout(4000);
      await snap(page, 'interior-360');
      note('Interior 360 captured');
    } catch(e) {
      await snap(page, 'interior-360-timeout');
      note(`Interior timeout: ${e.message?.slice(0,60)}`);
    }

    fs.writeFileSync(path.join(DEEP, 'log-remaining.txt'), log.join('\n'));
    note('\n=== ZENORA REMAINING DONE ===');

  } catch(err) {
    console.error(err.message);
  }
  await browser.close();
  console.log(log.join('\n'));
}

main();
