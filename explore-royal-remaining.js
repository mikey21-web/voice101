const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const MAIN = 'https://nikhilaconstructions.com/royal-pavilion';
const WEBSITE = 'https://ncd-eight.vercel.app';
const NCD = 'https://nikhilaconstructions.com';
const DEEP = path.join(__dirname, 'screenshots-royal-pavilion', 'deep-dive');
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
    // === MAIN NCD ROYAL PAVILION PAGE ===
    note('=== MAIN NCD SITE ===');
    await page.goto(MAIN, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(5000);
    await snap(page, 'main-loaded');

    const mainHeight = await page.evaluate(() => document.body.scrollHeight);
    note(`Page height: ${mainHeight}px`);

    // Screenshot full page
    try { await page.screenshot({ path: path.join(DEEP, 'main-fullpage.png'), fullPage: true }); } catch(e) {
      await page.screenshot({ path: path.join(DEEP, 'main-fullpage.png'), clip: { x: 0, y: 0, width: 1920, height: Math.min(mainHeight, 10000) } });
    }

    // Scroll to capture key sections
    const scrollPoints = [0, 500, 1500, 3000, 5000, 7000, 9000, 11000, 13000];
    for (const sp of scrollPoints) {
      if (sp < mainHeight) {
        await page.evaluate(y => window.scrollTo(0, y), sp);
        await page.waitForTimeout(1000);
        await snap(page, `main-scroll-${sp}`);
      }
    }

    // Extract all section headings
    const allHeadings = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({
        level: h.tagName,
        text: h.innerText.trim()
      }));
    }).catch(() => []);
    fs.writeFileSync(path.join(DEEP, 'main-headings.json'), JSON.stringify(allHeadings, null, 2));
    note(`Headings: ${allHeadings.length}`);

    // Check for video/audio players
    const videos = await page.$$('video, iframe[src*="youtube"], iframe[src*="vimeo"]');
    note(`Videos/iframes: ${videos.length}`);

    // Look for floor plan tabs (Block A/B/C)
    const blockTabs = await page.$$('[class*="block"] a, [class*="floor"] a, [data-tab]');
    note(`Block/floor tabs: ${blockTabs.length}`);

    // === VERCEl SITE ===
    note('\n=== VERCEl SITE ===');
    await page.goto(WEBSITE, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);
    await snap(page, 'vercel-loaded');

    // Full page screenshot
    const vHeight = await page.evaluate(() => document.body.scrollHeight).catch(() => 5000);
    try { await page.screenshot({ path: path.join(DEEP, 'vercel-fullpage.png'), fullPage: true }); } catch(e) {
      await page.screenshot({ path: path.join(DEEP, 'vercel-fullpage.png'), clip: { x: 0, y: 0, width: 1920, height: Math.min(vHeight, 10000) } });
    }

    // Scroll through in steps
    const vScroll = [0, 500, 1500, 3000, 5000, 7000, 9000];
    for (const sp of vScroll) {
      if (sp < vHeight) {
        await page.evaluate(y => window.scrollTo(0, y), sp);
        await page.waitForTimeout(1000);
        await snap(page, `vercel-scroll-${sp}`);
      }
    }

    // Click Previous/Next carousel
    await clickF(page, 'button:has-text("Next")', 'vercel-carousel-next1');
    await clickF(page, 'button:has-text("Previous")', 'vercel-carousel-prev');
    await clickF(page, 'button:has-text("Next")', 'vercel-carousel-next2');

    // Click Block A/B/C floor plan tabs
    for (const block of ['A', 'B', 'C']) {
      await clickF(page, `button:has-text("Block ${block}"), a:has-text("Block ${block}"), [data-block="${block}"]`, `vercel-block-${block}`);
    }

    // Click floor plan images
    const floorImages = await page.$$('img[src*="Floor"], img[src*="floor"], img[src*="plan"]');
    note(`Floor plan images: ${floorImages.length}`);

    // Check all links
    const allLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]')).map(a => ({
        text: a.innerText.trim().slice(0, 60),
        href: a.href,
        target: a.target
      }));
    }).catch(() => []);
    fs.writeFileSync(path.join(DEEP, 'vercel-all-links.json'), JSON.stringify(allLinks, null, 2));
    note(`Total links: ${allLinks.length}`);

    // Extract full text
    const text = await page.evaluate(() => document.body.innerText).catch(() => '');
    fs.writeFileSync(path.join(DEEP, 'vercel-text.txt'), text);
    note(`Vercel text: ${text.length} chars`);

    // === NCD MAIN SITE ===
    note('\n=== NCD MAIN SITE ===');
    await page.goto(NCD, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);
    await snap(page, 'ncd-main-loaded');

    const nHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.screenshot({ path: path.join(DEEP, 'ncd-fullpage.png'), clip: { x: 0, y: 0, width: 1920, height: Math.min(nHeight, 10000) } });

    // Scroll
    const nScroll = [0, 500, 2000, 4000, 6000, 8000];
    for (const sp of nScroll) {
      if (sp < nHeight) {
        await page.evaluate(y => window.scrollTo(0, y), sp);
        await page.waitForTimeout(800);
        await snap(page, `ncd-scroll-${sp}`);
      }
    }

    // Check for SPIM/WebVerse references
    const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase()).catch(() => '');
    const spimRefs = {
      hasSpim: bodyText.includes('spim'),
      hasWebverse: bodyText.includes('webverse'),
      hasRoyal: bodyText.includes('royal pavilion')
    };
    fs.writeFileSync(path.join(DEEP, 'spim-refs.json'), JSON.stringify(spimRefs, null, 2));
    note(`SPIM refs: ${JSON.stringify(spimRefs)}`);

    // Extract NCD text
    const ncdText = await page.evaluate(() => document.body.innerText).catch(() => '');
    fs.writeFileSync(path.join(DEEP, 'ncd-text.txt'), ncdText);
    note(`NCD text: ${ncdText.length} chars`);

    fs.writeFileSync(path.join(DEEP, 'log.txt'), log.join('\n'));
    note('\n=== ROYAL PAVILION 100% DONE ===');

  } catch(err) {
    console.error(err.message);
  }
  await browser.close();
  console.log(log.join('\n'));
}

main();
