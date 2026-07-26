import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const BASE = 'https://zenvistas.spimproject.com';

async function downloadPage(url, saveDir, visited = new Set()) {
  if (visited.has(url)) return;
  visited.add(url);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log(`\n=== Downloading: ${url} ===`);
  
  // Collect all network responses
  const assets = new Map();
  page.on('response', async (response) => {
    const req = response.request();
    const resUrl = response.url();
    const resourceType = req.resourceType();
    
    // Only download same-origin resources
    if (!resUrl.startsWith(BASE)) return;
    
    try {
      const buffer = await response.body();
      assets.set(resUrl, { buffer, resourceType });
    } catch (e) {
      // ignore
    }
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  // Extra wait for any lazy-loaded content
  await page.wait_for_timeout(3000);
  
  // Save the HTML
  const html = await page.content();
  const urlPath = new URL(url).pathname;
  const htmlPath = join(saveDir, urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''));
  mkdirSync(dirname(htmlPath), { recursive: true });
  writeFileSync(htmlPath, html);
  console.log(`  Saved: ${htmlPath}`);

  // Save all assets
  for (const [assetUrl, { buffer, resourceType }] of assets) {
    const assetPath = new URL(assetUrl).pathname;
    const localPath = join(saveDir, assetPath.replace(/^\//, ''));
    if (resourceType === 'document') continue; // already saved
    try {
      mkdirSync(dirname(localPath), { recursive: true });
      writeFileSync(localPath, buffer);
      console.log(`  Asset: ${assetPath}`);
    } catch (e) {
      // skip
    }
  }

  // Find all same-origin links and download them too
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.getAttribute('href'))
      .filter(h => h && !h.startsWith('#') && !h.startsWith('http') && !h.startsWith('tel:') && !h.startsWith('mailto:') && !h.startsWith('whatsapp:') && !h.startsWith('//'))
      .map(h => h.startsWith('/') ? h : '/' + h);
  });

  await browser.close();

  // Recursively download linked pages
  for (const link of [...new Set(links)]) {
    const fullUrl = `${BASE}${link}`;
    if (!visited.has(fullUrl) && !link.match(/\.(pdf|webp|jpg|jpeg|png|gif|svg|mp4|mp3|ico|woff2?|ttf|eot|css|js)$/)) {
      await downloadPage(fullUrl, saveDir, visited);
    }
  }
}

const saveDir = join(process.cwd(), 'zenvistas-clone');
console.log(`Saving to: ${saveDir}`);
downloadPage(`${BASE}/`, saveDir).then(() => console.log('\n=== DONE ===')).catch(e => console.error(e));
