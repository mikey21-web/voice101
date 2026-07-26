import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const assets = [
  // Logos
  { url: 'https://zenvistas.spimproject.com/assets/logos/spim_logo.webp', dest: 'assets/logos/spim_logo.webp' },
  { url: 'https://zenvistas.spimproject.com/assets/logos/zenora_logo.webp', dest: 'assets/logos/zenora_logo.webp' },
  { url: 'https://zenvistas.spimproject.com/assets/logos/zenora_logo_1.webp', dest: 'assets/logos/zenora_logo_1.webp' },
  { url: 'https://zenvistas.spimproject.com/assets/logos/zenvistas_logo.webp', dest: 'assets/logos/zenvistas_logo.webp' },
  { url: 'https://zenvistas.spimproject.com/assets/logos/zenvistas_logo.png', dest: 'assets/logos/zenvistas_logo.png' },
  // Icons
  { url: 'https://zenvistas.spimproject.com/assets/icons/webverse.gif', dest: 'assets/icons/webverse.gif' },
  { url: 'https://zenvistas.spimproject.com/assets/icons/interior.gif', dest: 'assets/icons/interior.gif' },
  { url: 'https://zenvistas.spimproject.com/assets/icons/exterior.gif', dest: 'assets/icons/exterior.gif' },
  { url: 'https://zenvistas.spimproject.com/assets/icons/zoneiq.gif', dest: 'assets/icons/zoneiq.gif' },
  { url: 'https://zenvistas.spimproject.com/assets/icons/maps.gif', dest: 'assets/icons/maps.gif' },
  { url: 'https://zenvistas.spimproject.com/assets/icons/contact.gif', dest: 'assets/icons/contact.gif' },
  // Background/Misc
  { url: 'https://zenvistas.spimproject.com/assets/rotate-device.png', dest: 'assets/rotate-device.png' },
  { url: 'https://zenvistas.spimproject.com/assets/zen_vista_layout_day.webp', dest: 'assets/zen_vista_layout_day.webp' },
  { url: 'https://zenvistas.spimproject.com/assets/zenvistas_night_video.mp4', dest: 'assets/zenvistas_night_video.mp4' },
  { url: 'https://zenvistas.spimproject.com/assets/googlemaps.png', dest: 'assets/googlemaps.png' },
  { url: 'https://zenvistas.spimproject.com/assets/1.jpg', dest: 'assets/1.jpg' },
  // Front View
  { url: 'https://zenvistas.spimproject.com/assets/frontview/5.6_north.webp', dest: 'assets/frontview/5.6_north.webp' },
  { url: 'https://zenvistas.spimproject.com/assets/frontview/7.0_north.webp', dest: 'assets/frontview/7.0_north.webp' },
  // Brochure PDF
  { url: 'https://zenvistas.spimproject.com/assets/brochure.pdf', dest: 'assets/brochure.pdf' },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, dest);
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    const file = fs.createWriteStream(fullPath);
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, response => {
      if (response.statusCode === 404) {
        file.close();
        fs.unlinkSync(fullPath);
        console.log(`  ❌ 404: ${url}`);
        resolve(false);
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        const stats = fs.statSync(fullPath);
        console.log(`  ✅ ${dest} (${(stats.size / 1024).toFixed(1)} KB)`);
        resolve(true);
      });
    }).on('error', err => {
      file.close();
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      console.log(`  ❌ Error: ${url} - ${err.message}`);
      resolve(false);
    });
  });
}

async function main() {
  console.log('Downloading assets...\n');
  let success = 0, fail = 0;
  for (const asset of assets) {
    const ok = await download(asset.url, asset.dest);
    if (ok) success++; else fail++;
  }
  console.log(`\nDone: ${success} downloaded, ${fail} failed`);
}

main().catch(console.error);
