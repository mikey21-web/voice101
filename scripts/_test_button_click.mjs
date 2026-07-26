import { chromium } from 'playwright';

const EMAIL = 'udayakirantumma@gmail.com';
const PASS = '8074228036';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();

  await page.goto('https://realestate.deploysafe.in/dashboard/login', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1000);
  const emailSel = 'input:not([type="password"]):not([type="hidden"])';
  await page.locator(emailSel).first().fill(EMAIL).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PASS).catch(() => {});
  await page.locator('button[type="submit"], button:has-text("Log")').first().click().catch(() => {});
  await page.waitForTimeout(3000);

  await page.goto('https://realestate.deploysafe.in/dashboard/#/properties/27c6d8d2-1562-4fc5-aefa-e942f437dc37', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const btn = page.locator('button:has-text("Copy Shareable Link")');
  const btnCount = await btn.count();
  console.log('BUTTON_FOUND:', btnCount > 0);

  if (btnCount > 0) {
    await btn.first().click();
    await page.waitForTimeout(1500);
    const clipboard = await page.evaluate(() => navigator.clipboard.readText()).catch(e => 'CLIPBOARD_ERROR: ' + e.message);
    console.log('CLIPBOARD_CONTENT:', clipboard);
    const toastText = await page.evaluate(() => document.body.innerText).catch(() => '');
    console.log('TOAST_VISIBLE:', toastText.includes('copied'));
  }

  await page.screenshot({ path: 'c:/Users/TUMMA/OneDrive/Desktop/open code projects/virtual assisant/scripts/_button_click_test.png', fullPage: true });
  await browser.close();
})();
