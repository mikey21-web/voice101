import { chromium } from 'playwright';

const url = 'https://realestate.deploysafe.in/dashboard/#/collection/realestate-niche-test-villa-deux8,collection-test-flat-b-25trc,collection-test-flat-c-faaeg';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // No login, no cookies, no localStorage token — simulates a cold lead clicking the link.
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1500);
  const text = await page.evaluate(() => document.body.innerText);
  console.log('=== PAGE TEXT ===');
  console.log(text);
  await page.screenshot({ path: 'c:/Users/TUMMA/OneDrive/Desktop/open code projects/virtual assisant/scripts/_collection_page_test.png', fullPage: true });
  await browser.close();
})();
