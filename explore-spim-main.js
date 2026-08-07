const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SPIM = 'https://www.spimproject.com';
const OUT = path.join(__dirname, 'screenshots-spim-main');

async function extractPage(page, label, url) {
  console.log(`\n=== ${label}: ${url} ===`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const dir = path.join(OUT, label.replace(/[\/\s:]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });

  await page.screenshot({ path: path.join(dir, 'fullpage.png'), fullPage: true });
  await page.screenshot({ path: path.join(dir, 'viewport.png') });

  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(dir, 'content.txt'), text);

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.innerText.trim().slice(0, 100),
      href: a.href,
      title: a.title
    })).filter(l => l.href);
  });
  fs.writeFileSync(path.join(dir, 'links.json'), JSON.stringify(links, null, 2));

  const images = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src,
      alt: img.alt,
      width: img.width,
      height: img.height
    }));
  });
  fs.writeFileSync(path.join(dir, 'images.json'), JSON.stringify(images, null, 2));

  const structure = await page.evaluate(() => {
    const metas = Array.from(document.querySelectorAll('meta')).map(m => ({
      name: m.getAttribute('name') || m.getAttribute('property'),
      content: m.getAttribute('content')
    })).filter(m => m.name);
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
      level: h.tagName,
      text: h.innerText.trim()
    }));
    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.innerText.trim(),
      type: b.type,
      class: b.className?.slice(0, 80)
    }));
    return { metas, headings, buttons };
  });
  fs.writeFileSync(path.join(dir, 'structure.json'), JSON.stringify(structure, null, 2));

  const interactive = await page.evaluate(() => {
    const items = [];
    document.querySelectorAll('[onclick], button, a[href], [class*="btn"], [class*="tab"], [class*="toggle"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        items.push({
          tag: el.tagName,
          text: el.innerText?.trim()?.slice(0, 80),
          class: el.className?.slice(0, 80),
          id: el.id,
          href: el.href
        });
      }
    });
    return items;
  });
  fs.writeFileSync(path.join(dir, 'interactive.json'), JSON.stringify(interactive, null, 2));

  console.log(`  -> ${text.length} chars, ${links.length} links, ${images.length} images`);
  return { text, links, images };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log('Output directory:', OUT);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  try {
    await extractPage(page, 'home', SPIM);
    await extractPage(page, 'about', `${SPIM}/about.html`);
    await extractPage(page, 'blog', `${SPIM}/blog.html`);
    await extractPage(page, 'webverse', `${SPIM}/webverse.html`);
    await extractPage(page, 'zone-iq', `${SPIM}/zone-iq-drone-mapping.html`);
    await extractPage(page, 'virtual-tour', `${SPIM}/360-virtual-property-tour.html`);
    await extractPage(page, 'vr', `${SPIM}/vr.html`);
    await extractPage(page, 'digiverse', `${SPIM}/digiverse.html`);
    await extractPage(page, 'immersion-center', `${SPIM}/real-estate-immersion-center.html`);
    await extractPage(page, 'contact', `${SPIM}/contact.html`);
    await extractPage(page, 'privacy', `${SPIM}/privacy-policy.html`);
    await extractPage(page, 'terms', `${SPIM}/terms-and-conditions.html`);
  } catch (err) {
    console.error('Error:', err.message);
  }

  await browser.close();
  console.log('\n========== SPIM MAIN SITE EXPLORATION COMPLETE ==========');
}

main();
