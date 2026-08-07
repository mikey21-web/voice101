const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SPIM = 'https://www.spimproject.com';
const DEEP = path.join(__dirname, 'screenshots-spim-main', 'deep-dive');
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

async function explorePage(page, label, url) {
  note(`\n=== ${label} ===`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  await snap(page, `${label}-loaded`);

  // Scroll in thirds
  const h = await page.evaluate(() => document.body.scrollHeight).catch(() => 2000);
  for (const pos of [Math.round(h/3), Math.round(h*2/3), h-200]) {
    if (pos > 0) {
      await page.evaluate(y => window.scrollTo(0, y), pos).catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

  // Try clicking accordion/FAQ items
  const toggles = await page.$$('[class*="accordion"], [class*="toggle"], details, button:has-text("+")');
  note(`Toggles: ${toggles.length}`);
  for (let i = 0; i < Math.min(toggles.length, 6); i++) {
    try {
      const text = await toggles[i].evaluate(el => el.innerText.trim().slice(0, 40)).catch(() => '');
      await toggles[i].click({ force: true });
      await page.waitForTimeout(800);
      await snap(page, `${label}-toggle-${i}-${text.replace(/[^a-zA-Z0-9]/g, '_').slice(0,15)}`);
    } catch(e) {}
  }

  // Menu if exists
  await clickF(page, 'button:has-text("Menu"), .hamburger, [class*="menu-toggle"]', `${label}-menu`);
  await clickF(page, 'button:has-text("×"), .close', `${label}-menu-close`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('dialog', async d => { try { await d.dismiss(); } catch(e) {} });

  try {
    await explorePage(page, 'home', SPIM);
    // Home-specific: FAQ + testimonials
    for (let i = 0; i < 3; i++) {
      await clickF(page, 'button:has-text("+")', `home-faq-${i}`);
    }
    // Scroll to Webverse demo section
    await page.evaluate(() => window.scrollTo(0, 2500));
    await page.waitForTimeout(500);
    await snap(page, 'home-webverse-demo');

    await explorePage(page, 'about', `${SPIM}/about.html`);
    await explorePage(page, 'webverse', `${SPIM}/webverse.html`);
    await explorePage(page, 'zone-iq', `${SPIM}/zone-iq-drone-mapping.html`);
    await explorePage(page, 'vtour', `${SPIM}/360-virtual-property-tour.html`);
    await explorePage(page, 'vr', `${SPIM}/vr.html`);
    await explorePage(page, 'digiverse', `${SPIM}/digiverse.html`);
    await explorePage(page, 'immersion', `${SPIM}/real-estate-immersion-center.html`);
    await explorePage(page, 'contact', `${SPIM}/contact.html`);
    await explorePage(page, 'privacy', `${SPIM}/privacy-policy.html`);
    await explorePage(page, 'terms', `${SPIM}/terms-and-conditions.html`);
    await explorePage(page, 'blog', `${SPIM}/blog.html`);

    // Check key CTAs
    await page.goto(SPIM, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    const ctas = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).filter(a => 
        /demo|book|discover|learn|experience|try/i.test(a.innerText)
      ).map(a => ({ text: a.innerText.trim().slice(0, 50), href: a.href }));
    });
    fs.writeFileSync(path.join(DEEP, 'ctas.json'), JSON.stringify(ctas, null, 2));
    note(`CTAs found: ${ctas.length}`);

    // Check client logos
    const logos = await page.$$('img[alt*="logo"], img[alt*="client"], img[class*="client"]');
    note(`Client logos: ${logos.length}`);

    fs.writeFileSync(path.join(DEEP, 'log.txt'), log.join('\n'));
    note('\n=== SPIM 100% DONE ===');

  } catch(err) {
    console.error(err.message);
  }
  await browser.close();
  console.log(log.join('\n'));
}

main();
