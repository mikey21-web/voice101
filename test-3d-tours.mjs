import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, 'webverse-clone');
const PORT = 8080;

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
  '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf', '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const fp = join(root, p);
  if (existsSync(fp)) {
    const ext = extname(fp).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(readFileSync(fp));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  server.listen(PORT);
  console.log(`Server on :${PORT}`);

  const browser = await chromium.launch({ headless: true });
  let passed = 0, failed = 0;

  async function test(name, fn) {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    try {
      await fn(page);
      console.log(`  \u2705 ${name}`);
      passed++;
    } catch (e) {
      console.log(`  \u274c ${name}: ${e.message?.slice(0, 120)}`);
      failed++;
    } finally { await ctx.close(); }
  }

  await test('unitId param navigates to unit plan', async (page) => {
    await page.goto(`http://localhost:${PORT}/?unitId=Flat_2_Floor_3`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
    const visible = await page.locator('#unitPlans').isVisible();
    if (!visible) throw new Error('unitPlans not visible');
    const label = await page.locator('#unitPlanFlatNumberLabel').textContent();
    if (!label.includes('Flat: 2')) throw new Error(`Wrong flat: ${label}`);
    const floor = await page.locator('#unitPlanFloorNumberLabel').textContent();
    if (!floor.includes('Floor: 3')) throw new Error(`Wrong floor: ${floor}`);
    const src = await page.locator('#unitPlanImg').getAttribute('src');
    if (!src) throw new Error('Unit plan image not set');
    const vtBtn = page.locator('#unitPlanVirtualTourLink');
    if (!(await vtBtn.isVisible())) throw new Error('360 tour button not visible');
  });

  await test('360 tour button opens hookbot iframe', async (page) => {
    await page.goto(`http://localhost:${PORT}/?unitId=Flat_2_Floor_3`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000);
    await page.locator('#unitPlanVirtualTourLink').click();
    await sleep(3000);
    const vt = await page.locator('#virtualTour').isVisible();
    if (!vt) throw new Error('virtualTour not shown after click');
    const src = await page.locator('#virtualTourLink').getAttribute('src');
    if (!src?.includes('hookbot.in')) throw new Error(`src not hookbot: ${src}`);
    console.log(`     iframe src: ${src}`);
  });

  await test('Home Interior button shows virtual tour cards', async (page) => {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle', timeout: 20000 });
    await sleep(1000);
    await page.locator('.featuresPanel [data-type="interior"]').click();
    await sleep(2000);
    const interior = await page.locator('#interior').isVisible();
    if (!interior) throw new Error('interior view not visible');
    const cards = await page.locator('#virtualTourList button').count();
    console.log(`     tour cards: ${cards}`);
  });

  await test('Home Webverse button shows layout view', async (page) => {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle', timeout: 20000 });
    await sleep(1000);
    await page.locator('.featuresPanel [data-type="webverse"]').click();
    await sleep(3000);
    const wv = await page.locator('#webverse').isVisible();
    if (!wv) throw new Error('webverse not visible');
    const img = await page.locator('#layoutImage').getAttribute('src');
    if (!img) throw new Error('layout image not set');
    console.log(`     layout: ${img}`);
  });

  await test('Clubhouse hookbot URLs resolve', async (page) => {
    const urls = [
      'https://hookbot.in/viewer/index.php?code=63dc7ed1010d3c3b8269faf0ba7491d4',
      'https://hookbot.in/viewer/index.php?code=74db120f0a8e5646ef5a30154e9f6deb',
      'https://hookbot.in/viewer/index.php?code=3b8a614226a953a8cd9526fca6fe9ba5',
      'https://hookbot.in/viewer/index.php?code=45fbc6d3e05ebd93369ce542e8f2322d',
    ];
    for (const url of urls) {
      const resp = await page.request.get(url);
      if (resp.status() !== 200) throw new Error(`${url} status ${resp.status()}`);
    }
    console.log(`     all 4 clubhouse hookbot codes OK`);
  });

  await test('Flat_10_Floor_14 loads unit plan', async (page) => {
    await page.goto(`http://localhost:${PORT}/?unitId=Flat_10_Floor_14`, { waitUntil: 'networkidle', timeout: 20000 });
    await sleep(2000);
    const visible = await page.locator('#unitPlans').isVisible();
    if (!visible) throw new Error('unitPlans not visible');
    const src = await page.locator('#unitPlanImg').getAttribute('src');
    console.log(`     unit plan img: ${src}`);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  await browser.close();
  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

main();
