const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://zenvistas.spimproject.com';
const OUT = path.join(__dirname, 'screenshots-zenora');
const DEEP = path.join(OUT, 'deep-dive');
fs.mkdirSync(DEEP, { recursive: true });

const log = [];
function note(msg) { console.log(msg); log.push(msg); }

async function snap(page, name) {
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(DEEP, `${name}.png`) });
}

async function clickForce(page, selector, name) {
  const el = await page.$(selector);
  if (el) {
    try {
      await el.click({ force: true });
      await page.waitForTimeout(1500);
      await snap(page, name);
      return true;
    } catch(e) {
      note(`  click failed on "${name}": ${e.message?.slice(0, 60)}`);
      return false;
    }
  }
  return false;
}

async function clickAllMatching(page, selector, namePrefix) {
  const els = await page.$$(selector);
  note(`Found ${els.length} elements matching "${selector}"`);
  for (let i = 0; i < els.length; i++) {
    try {
      const text = await els[i].evaluate(el => el.innerText.trim().slice(0, 50)).catch(() => '');
      await els[i].click({ force: true });
      await page.waitForTimeout(1200);
      await snap(page, `${namePrefix}-${i}-${text.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)}`);
      note(`  clicked ${i}: "${text.slice(0, 30)}"`);
    } catch(e) {
      note(`  element ${i} click failed: ${e.message?.slice(0, 60)}`);
    }
  }
  return els.length;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  // Suppress dialog alerts
  page.on('dialog', async dialog => { try { await dialog.dismiss(); } catch(e) {} });

  try {
    // ========= 1. WEBVERSE PAGE =========
    note('=== 1. WEBVERSE PAGE ===');
    await page.goto(`${BASE}/webverse.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);
    await snap(page, '01-webverse-initial');

    // Click Filters button using force
    await clickForce(page, '#webverseFilters h1, button:has-text("Filters"), [class*="filter"]', '02-webverse-filters');
    
    // Click orientation: North
    await clickForce(page, 'li:has-text("North")', '03-webverse-north');
    
    // Click orientation: South
    await clickForce(page, 'li:has-text("South")', '04-webverse-south');
    
    // Click Type 1, 2, 3
    await clickForce(page, 'li.type-btn:has-text("Type 1")', '05-webverse-type1');
    await clickForce(page, 'li.type-btn:has-text("Type 2")', '06-webverse-type2');
    await clickForce(page, 'li.type-btn:has-text("Type 3")', '07-webverse-type3');

    // Click Reset All
    await clickForce(page, 'button:has-text("Reset")', '08-webverse-reset');

    // Click individual villa units
    const unitCount = await clickAllMatching(page, 'li.unit-btn', '09-unit');
    note(`Clicked ${Math.min(unitCount, 26)} units`);

    // Click Night mode
    await clickForce(page, 'li:has-text("NIGHT"), button:has-text("NIGHT")', '10-webverse-night');
    // Click Night again to go back to Day
    await clickForce(page, 'li:has-text("NIGHT"), button:has-text("NIGHT")', '11-webverse-day');

    // Click view tabs
    for (const tab of ['Aerial View', 'Community', 'Interior', 'Google Maps', 'Zone IQ']) {
      await clickForce(page, `li.tab-btn:has-text("${tab}")`, `12-tab-${tab.replace(/\s/g, '')}`);
    }

    // Click Explore More
    await clickForce(page, 'button:has-text("Explore")', '13-webverse-explore');

    // Click WhatsApp contact
    await clickForce(page, 'a[href*="whatsapp"], a[href*="wa.me"]', '14-webverse-whatsapp');
    await page.goBack().catch(() => {});

    // ========= 2. HOME PAGE =========
    note('\n=== 2. HOME PAGE ===');
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(4000);
    await snap(page, '20-home-loaded');

    // Click Menu
    await clickForce(page, 'button:has-text("Menu")', '21-home-menu');
    
    // Try clicking menu items in drawer
    const menuLinks = await page.$$('nav a, [class*="drawer"] a, [class*="menu"] a');
    note(`Menu drawer links: ${menuLinks.length}`);
    for (let i = 0; i < menuLinks.length; i++) {
      try {
        const text = await menuLinks[i].evaluate(el => el.innerText.trim()).catch(() => '');
        const href = await menuLinks[i].evaluate(el => el.href).catch(() => '');
        if (text) note(`  Menu link ${i}: "${text}" -> ${href}`);
      } catch(e) {}
    }

    // Close menu
    await clickForce(page, 'button:has-text("×")', '22-home-menu-close');

    // Click each tab
    for (const tab of ['Aerial View', 'Community', 'Interior', 'Google Maps', 'Zone IQ']) {
      await clickForce(page, `li:has-text("${tab}")`, `23-home-${tab.replace(/\s/g, '')}`);
    }

    // Click Full Screen
    await clickForce(page, 'button:has-text("Full")', '24-home-fullscreen');

    // Contact button
    await clickForce(page, 'a[href*="whatsapp"], a[href*="wa.me"]', '25-home-contact');
    await page.goBack().catch(() => {});

    // ========= 3. MAPS PAGE =========
    note('\n=== 3. MAPS PAGE ===');
    await page.goto(`${BASE}/maps.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);
    await snap(page, '30-maps-loaded');

    // Click Zone IQ filters
    for (const f of ['Travel', 'Destination', 'Education', 'Work', 'Shopping', 'Hospitals']) {
      await clickForce(page, `button:has-text("${f}")`, `31-maps-filter-${f}`);
    }

    // Click view tabs
    for (const tab of ['Aerial View', 'Exterior', 'Interior', 'Google Maps', 'Zone IQ']) {
      await clickForce(page, `li:has-text("${tab}")`, `32-maps-${tab.replace(/\s/g, '')}`);
    }

    // ========= 4. ABOUT PAGE =========
    note('\n=== 4. ABOUT PAGE ===');
    await page.goto(`${BASE}/about.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await snap(page, '40-about-loaded');

    // Click all tabs
    for (const tab of ['Aerial View', 'Community', 'Interior', 'Google Maps', 'Zone IQ']) {
      await clickForce(page, `li:has-text("${tab}")`, `41-about-${tab.replace(/\s/g, '')}`);
    }

    // ========= 5. GALLERY PAGE =========
    note('\n=== 5. GALLERY PAGE ===');
    await page.goto(`${BASE}/gallery.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await snap(page, '50-gallery-loaded');
    
    await clickForce(page, 'button:has-text("Next")', '51-gallery-next');
    await clickForce(page, 'button:has-text("Previous")', '52-gallery-prev');
    await clickForce(page, 'button:has-text("View All")', '53-gallery-viewall');
    await clickForce(page, 'button:has-text("Amenities")', '54-gallery-amenities');

    // ========= 6. CONTACT PAGE =========
    note('\n=== 6. CONTACT PAGE ===');
    await page.goto(`${BASE}/contact.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await snap(page, '60-contact-loaded');

    // Get form details
    const formData = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
      return {
        inputs: inputs.map(i => ({ name: i.name, type: i.type, placeholder: i.placeholder, id: i.id })),
        buttons: Array.from(document.querySelectorAll('button, input[type="submit"]')).map(b => ({
          text: b.innerText?.trim() || b.value || ''
        }))
      };
    }).catch(() => ({}));
    fs.writeFileSync(path.join(DEEP, 'contact-form.json'), JSON.stringify(formData, null, 2));
    note(`Contact form inputs: ${formData?.inputs?.length || 0}, buttons: ${formData?.buttons?.length || 0}`);

    // ========= 7. BROCHURE PAGE =========
    note('\n=== 7. BROCHURE PAGE ===');
    await page.goto(`${BASE}/brochure.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    await snap(page, '70-brochure-loaded');
    const broText = await page.evaluate(() => document.body.innerText).catch(() => '');
    note(`Brochure: ${broText.slice(0, 200)}`);

    // ========= 8. EXTERIOR 360 =========
    note('\n=== 8. EXTERIOR 360 ===');
    try {
      await page.goto(`${BASE}/exterior.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(4000);
      await snap(page, '80-exterior');
      note(`Exterior 360 loaded`);
    } catch(e) {
      note(`Exterior timeout - taking snapshot anyway`);
      await snap(page, '80-exterior-timeout');
    }

    // ========= 9. INTERIOR 360 =========
    note('\n=== 9. INTERIOR 360 ===');
    try {
      await page.goto(`${BASE}/interior.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(4000);
      await snap(page, '90-interior');
      note(`Interior 360 loaded`);
    } catch(e) {
      note(`Interior timeout - taking snapshot anyway`);
      await snap(page, '90-interior-timeout');
    }

    // Save log
    fs.writeFileSync(path.join(DEEP, 'action-log.txt'), log.join('\n'));
    note('\n========== ZENORA 100% ==========');

  } catch (err) {
    console.error('FATAL:', err.message);
    await snap(page, 'error');
  }

  await browser.close();
  console.log(log.join('\n'));
}

main();
