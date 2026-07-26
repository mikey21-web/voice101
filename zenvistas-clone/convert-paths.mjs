import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const htmlFiles = [
  'index.html', 'webverse.html', 'about.html', 'gallery.html',
  'contact.html', 'brochure.html', 'exterior.html', 'zoneiq.html',
  'maps.html', 'virtualtour.html', 'villa.html'
];

const jsFiles = [
  'js/gallery.js', 'js/about.js', 'js/contact.js', 'js/brochure.js',
  'js/exterior.js', 'js/zoneiq.js', 'js/maps.js', 'js/virtualtour.js',
  'js/villa.js', 'js/webverse.js'
];

// Fix HTML files: absolute paths to relative
for (const f of htmlFiles) {
  const fp = path.join(__dirname, f);
  let content = fs.readFileSync(fp, 'utf-8');
  
  // Fix href="/page.html" -> href="./page.html"
  content = content.replace(/href="\/([a-z]+\.html)"/g, 'href="./$1"');
  // Fix src="/js/..." -> src="./js/..."
  content = content.replace(/src="\/(js\/[^"]+)"/g, 'src="./$1"');
  
  fs.writeFileSync(fp, content, 'utf-8');
  console.log(`  ✅ ${f}`);
}

// Fix JS files: ../assets/ -> ./assets/
for (const f of jsFiles) {
  const fp = path.join(__dirname, f);
  let content = fs.readFileSync(fp, 'utf-8');
  content = content.replace(/\.\.\/assets\//g, './assets/');
  fs.writeFileSync(fp, content, 'utf-8');
  console.log(`  ✅ ${f}`);
}

console.log('\nAll paths converted!');
