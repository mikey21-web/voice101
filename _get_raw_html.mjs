import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'https://royalpavilion.spim-webverse.com/';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();

// Block Tailwind CDN so we get the raw HTML without injected CSS
await ctx.route('**/tailwindcss/**', route => route.abort());

const page = await ctx.newPage();

// Get the raw document before any JS runs
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

// Extract the raw HTML structure (without Tailwind-injected style blocks)
const raw = await page.content();
// Remove all inline style blocks that Tailwind injects
const cleaned = raw.replace(/<style[\s\S]*?<\/style>/g, '');
// Remove Font Awesome injected styles too
const cleaned2 = cleaned.replace(/<style media="all"[\s\S]*?<\/style>/g, '');

fs.writeFileSync('./docs/spim-analysis/deep/raw-html.html', cleaned2);
console.log('Saved raw HTML! Length:', cleaned2.length);

await browser.close();
