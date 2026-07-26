import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const URL = 'https://royalpavilion.spim-webverse.com/';
const OUT = join(process.cwd(), 'royalpavilion-clone');
const VIEWS = ['home', 'webverse', 'interior', 'floorPlans', 'amenities', 'about', 'exterior', 'gallery', 'brochure', 'contact', 'features', 'clubhouse'];

async function jsNav(page, section) {
  await page.evaluate((s) => {
    const el = document.getElementById(s);
    if (el) {
      document.querySelectorAll('body > [id]').forEach(v => {
        if (['logoWrapper', 'commonBtnsWrapper', s].includes(v.id)) return;
        v.style.display = 'none';
      });
      el.style.display = '';
    }
  }, section);
  await page.waitForTimeout(400);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const assets = new Map();
  page.on('response', async (response) => {
    const resUrl = response.url();
    if (!resUrl.startsWith('https://royalpavilion.spim-webverse.com')) return;
    const req = response.request();
    if (req.resourceType() === 'document') return;
    if (assets.has(resUrl)) return;
    try {
      const buffer = await response.body();
      assets.set(resUrl, buffer);
    } catch { /* ignore */ }
  });

  console.log('Loading home page...');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Also toggle day/night to grab both frame sets, and click through view-specific sub-interactions
  for (const view of VIEWS) {
    console.log(`Visiting view: ${view} (assets so far: ${assets.size})`);
    await jsNav(page, view);
    await page.waitForTimeout(800);
  }

  // Toggle theme (day/night) on webverse view to trigger night frame loads
  await jsNav(page, 'webverse');
  const themeToggle = await page.$('#themeToggleInput');
  if (themeToggle) {
    console.log('Toggling day/night...');
    await themeToggle.click().catch(() => {});
    await page.waitForTimeout(1500);
  }

  await jsNav(page, 'home');
  await page.waitForTimeout(500);

  // Save the fully rendered HTML (post-JS) and the raw server HTML
  const rawHtml = await page.evaluate(() => document.documentElement.outerHTML);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'index.html'), rawHtml);
  console.log(`Saved index.html`);

  console.log(`Saving ${assets.size} assets...`);
  for (const [assetUrl, buffer] of assets) {
    const assetPath = new URL(assetUrl).pathname;
    const localPath = join(OUT, assetPath.replace(/^\//, ''));
    try {
      mkdirSync(dirname(localPath), { recursive: true });
      writeFileSync(localPath, buffer);
    } catch (e) {
      console.log(`  failed: ${assetPath} - ${e.message}`);
    }
  }

  await browser.close();
  console.log(`\n=== DONE: ${assets.size} assets saved to ${OUT} ===`);
}

run().catch(e => { console.error(e); process.exit(1); });
