import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const files = [
  '/index.html',
  '/webverse.html',
  '/about.html',
  '/gallery.html',
  '/contact.html',
  '/brochure.html',
  '/exterior.html',
  '/zoneiq.html',
  '/maps.html',
  '/virtualtour.html',
  '/villa.html',
  '/js/gallery.js',
  '/js/about.js',
  '/js/contact.js',
  '/js/brochure.js',
  '/js/exterior.js',
  '/js/zoneiq.js',
  '/js/maps.js',
  '/js/virtualtour.js',
  '/js/villa.js',
  '/js/webverse.js',
];

function download(url, dest) {
  return new Promise(resolve => {
    const dir = path.dirname(dest);
    fs.mkdirSync(dir, { recursive: true });
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      if (response.statusCode === 404) {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        console.log(`  ❌ 404: ${url}`);
        resolve(false);
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        const stats = fs.statSync(dest);
        console.log(`  ✅ ${path.relative(__dirname, dest)} (${(stats.size / 1024).toFixed(1)} KB)`);
        resolve(true);
      });
    }).on('error', err => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      console.log(`  ❌ Error: ${url} - ${err.message}`);
      resolve(false);
    });
  });
}

async function main() {
  console.log('Downloading HTML pages and JS files...\n');
  let success = 0, fail = 0;
  for (const rel of files) {
    const url = `https://zenvistas.spimproject.com${rel}`;
    const dest = path.join(__dirname, rel === '/index.html' ? 'index.html' : rel.startsWith('/') ? rel.slice(1) : rel);
    const ok = await download(url, dest);
    if (ok) success++; else fail++;
  }
  console.log(`\nDone: ${success} downloaded, ${fail} failed`);
  console.log('\nNow run: node convert-paths.mjs to fix ../assets/ paths in HTML/JS files');
}

main().catch(console.error);
