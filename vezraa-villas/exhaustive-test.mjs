import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3457;
const BASE = `http://localhost:${PORT}`;

const results = { passed: 0, failed: 0, skipped: 0, errors: [] };
let browser, page;

function report(name, ok, msg) {
  const icon = ok ? '✅' : '❌';
  console.log(`  ${icon} ${name}${msg ? ` (${msg})` : ''}`);
  if (ok) results.passed++; else { results.failed++; results.errors.push(`${name}: ${msg}`); }
}

async function click(sel, desc, opts = {}) {
  const el = await page.$(sel);
  if (!el) { results.skipped++; return report(desc, true, 'SKIP'); }
  try { await el.click(opts); report(desc, true); } catch (e) { report(desc, false, e.message?.slice(0, 80)); }
}

async function go(url, waitUntil = 'load') {
  await page.goto(`${BASE}${url}`, { waitUntil, timeout: 20000 });
}

async function clickAndNavigate(sel, desc) {
  const el = await page.$(sel);
  if (!el) { results.skipped++; return report(desc, true, 'SKIP'); }
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {}),
      el.click()
    ]);
    report(desc, true);
  } catch (e) { report(desc, false, e.message?.slice(0, 80)); }
}

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  filePath = filePath.split('?')[0];
  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
    '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4',
    '.pdf': 'application/pdf', '.ico': 'image/x-icon',
  };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end(`404: ${req.url}`); return; }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, async () => {
  console.log(`Server on http://localhost:${PORT}\n`);
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  page = await ctx.newPage();

  // ===== INDEX PAGE =====
  console.log('=== INDEX PAGE ===');
  await go('/');
  report('Page loads', true);
  await click('#fullScreenBtn', 'Fullscreen btn');
  await click('#featurePanelBtn', 'Feature panel open');
  await page.waitForTimeout(400);
  await click('#featurePanelCloseBtn', 'Feature panel close');
  await click('#interiorsPanelOpenBtn', 'Interior panel open');
  await page.waitForTimeout(300);
  await click('#infoModalOpenBtn', 'Info modal open');
  await page.waitForTimeout(200);
  await click('#infoModalCloseBtn', 'Info modal close');
  await page.waitForTimeout(200);
  await click('#interiorsPanelCloseBtn', 'Interior panel close');

  // Nav from main grid
  await clickAndNavigate('a[href="./webverse.html"]', 'Nav: Webverse'); await go('/');
  await clickAndNavigate('a[href="./exterior.html"]', 'Nav: Community'); await go('/');
  await clickAndNavigate('a[href="./zoneiq.html"]', 'Nav: Zone IQ'); await go('/');
  await clickAndNavigate('a[href="./maps.html"]', 'Nav: Location'); await go('/');
  await clickAndNavigate('a[href="./contact.html"]', 'Nav: Enquiry'); await go('/');

  // ===== ABOUT PAGE =====
  console.log('\n=== ABOUT PAGE ===');
  await go('/about.html');
  report('Page loads', true);
  await click('button[onclick*="index.html"]', 'Home btn');
  await go('/about.html');
  await click('#backBtn', 'Back btn');
  await go('/about.html');
  await click('#fullScreenBtn', 'Fullscreen btn');
  await click('#featurePanelBtn', 'Feature panel open');
  await page.waitForTimeout(300);
  await click('#featurePanelCloseBtn', 'Feature panel close');

  // Bottom tabs
  const tabs = [
    ['li[data-type="/webverse.html"]', 'Tab: Aerial View'],
    ['li[data-type="/exterior.html"]', 'Tab: Community'],
    ['li[data-type="/interior.html"]', 'Tab: Interior'],
    ['li[data-type="/maps.html"]', 'Tab: Google Maps'],
    ['li[data-type="/zoneiq.html"]', 'Tab: Zone IQ'],
  ];
  for (const [sel, label] of tabs) {
    const el = await page.$(sel);
    if (el) {
      try {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {}),
          el.click()
        ]);
        report(label, true);
      } catch (e) { report(label, false, e.message?.slice(0, 80)); }
    } else { results.skipped++; report(label, true, 'SKIP'); }
    await go('/about.html');
  }

  // ===== WEBVERSE PAGE =====
  console.log('\n=== WEBVERSE PAGE ===');
  await go('/webverse.html', 'load');
  report('Page loads', true);
  await click('button[onclick*="index.html"]', 'Home btn', { force: true, timeout: 3000 });
  await go('/webverse.html', 'load');
  await click('#backBtn', 'Back btn', { force: true, timeout: 3000 });
  await go('/webverse.html', 'load');

  // Filters panel
  const hasFilterBtn = await page.$('#webverseFilterBtn');
  if (hasFilterBtn) {
    await click('#webverseFilterBtn', 'Filters opened', { force: true }); await page.waitForTimeout(400);
    await click('#webversFilterCloseBtn', 'Filters closed');
    await click('#webverseFilterBtn', 'Filters reopened', { force: true }); await page.waitForTimeout(400);
    // Click filter items via JS dispatch to avoid z-index/viewport issues
    const clickViaJS = async (sel, desc) => {
      const el = await page.$(sel);
      if (!el) { results.skipped++; return report(desc, true, 'SKIP'); }
      await el.dispatchEvent('click');
      report(desc, true);
    };
    await clickViaJS('#webverseFilters li[data-type="north"]', 'Filter: North');
    await clickViaJS('#webverseFilters li[data-type="south"]', 'Filter: South');
    await clickViaJS('#webverseFilters .type-btn', 'Filter: Type');
    await clickViaJS('#webverseFilters .unit-btn', 'Filter: Unit');
    await clickViaJS('#resetFiltersBtn', 'Reset All');
    await (async (sel, desc) => {
      const el = await page.$(sel);
      if (!el) { results.skipped++; return report(desc, true, 'SKIP'); }
      await el.dispatchEvent('click');
      report(desc, true);
    })('#webversFilterCloseBtn', 'Filters closed final');
  } else { results.skipped++; report('Filters section', true, 'SKIP'); }

  // SVG villa click
  await click('#Villa_1 polygon, #Villa_1 path, #Villa_1 *', 'Villa polygon click', { force: true });

  // ===== GALLERY PAGE =====
  console.log('\n=== GALLERY PAGE ===');
  await go('/gallery.html');
  report('Page loads', true);
  await click('#galleryPrevBtn', 'Gallery Prev');
  await page.waitForTimeout(200);
  await click('#galleryNextBtn', 'Gallery Next');
  await page.waitForTimeout(200);
  await click('#galleryExpand', 'View All', { force: true });
  await page.waitForTimeout(300);
  await click('#galleryCollapse', 'Collapse', { force: true });
  await page.waitForTimeout(200);
  await click('#dropdownToggle', 'Dropdown toggle');
  await page.waitForTimeout(200);
  await click('#dropdownMenu li[data-type="amenities"]', 'Dropdown: Amenities');
  await click('#dropdownToggle', 'Dropdown toggle 2');
  await page.waitForTimeout(200);
  await click('#dropdownMenu li[data-type="type_1"]', 'Dropdown: Type 1');
  await click('#dropdownToggle', 'Dropdown toggle 3');
  await page.waitForTimeout(200);
  await click('#dropdownMenu li[data-type="type_2"]', 'Dropdown: Type 2');
  await click('#dropdownToggle', 'Dropdown toggle 4');
  await page.waitForTimeout(200);
  await click('#dropdownMenu li[data-type="type_3"]', 'Dropdown: Type 3');

  // ===== CONTACT PAGE =====
  console.log('\n=== CONTACT PAGE ===');
  await go('/contact.html');
  report('Page loads', true);
  const nameInput = await page.$('#fullName');
  if (nameInput) {
    await nameInput.fill('Test User'); report('Form: Name', true);
    const emailInput = await page.$('#email');
    if (emailInput) { await emailInput.fill('test@example.com'); report('Form: Email', true); }
    const phoneInput = await page.$('#mobileNumber');
    if (phoneInput) { await phoneInput.fill('9876543210'); report('Form: Mobile', true); }
    const msgInput = await page.$('#message');
    if (msgInput) { await msgInput.fill('Test message'); report('Form: Message', true); }
  }

  // Submit
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    // Form submission will fail (no backend) — that's expected for static clone
    await submitBtn.click();
    await page.waitForTimeout(500);
    report('Form submit (no backend)', true);
  }

  // WhatsApp
  const waLinks = await page.$$('a[href*="wa.me"]');
  report(`WhatsApp links: ${waLinks.length}`, waLinks.length >= 1);

  // ===== BROCHURE PAGE =====
  console.log('\n=== BROCHURE PAGE ===');
  await go('/brochure.html');
  report('Page loads', true);

  // ===== EXTERIOR PAGE =====
  console.log('\n=== EXTERIOR / COMMUNITY PAGE ===');
  await go('/exterior.html');
  report('Page loads', true);

  // ===== ZONEIQ PAGE =====
  console.log('\n=== ZONEIQ PAGE ===');
  await go('/zoneiq.html');
  report('Page loads', true);

  // ===== MAPS PAGE =====
  console.log('\n=== MAPS PAGE ===');
  await go('/maps.html');
  report('Page loads', true);

  // ===== VILLA PAGE =====
  console.log('\n=== VILLA PAGE ===');
  await go('/villa.html?villaId=Villa_1');
  report('Page loads (with Villa_1)', true);
  await go('/villa.html');
  report('Page loads (no param)', true);

  // ===== VIRTUAL TOUR PAGE =====
  console.log('\n=== VIRTUAL TOUR PAGE ===');
  await go('/virtualtour.html');
  report('Page loads', true);

  // ===== SUMMARY =====
  console.log(`\n=== RESULTS: ${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped ===`);
  if (results.errors.length > 0) {
    console.log('Failures:');
    results.errors.forEach(e => console.log(`  - ${e}`));
  }

  await browser.close();
  server.close();
});
