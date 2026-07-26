import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3456;

// Simple static server
const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  
  // Remove query strings
  filePath = filePath.split('?')[0];

  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
    '.ico': 'image/x-icon',
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404: ${req.url}`);
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

// Track results
const results = { passed: 0, failed: 0, errors: [] };
const pages = [
  '/', '/about.html', '/webverse.html', '/gallery.html',
  '/contact.html', '/brochure.html', '/exterior.html',
  '/zoneiq.html', '/maps.html', '/villa.html?villaId=Villa_1',
  '/virtualtour.html', '/villa.html'
];

const assets = [
  '/css/style.css',
  '/js/script.js', '/js/webverse.js', '/js/villa.js',
  '/js/virtualtour.js', '/js/gallery.js', '/js/maps.js',
  '/js/about.js', '/js/contact.js', '/js/brochure.js',
  '/js/exterior.js', '/js/zoneiq.js', '/js/data.json',
  '/assets/logos/zenvistas_logo.webp',
  '/assets/icons/webverse.gif',
  '/assets/frontview/5.6_north.webp',
  '/assets/frontview/7.0_north.webp',
  '/assets/zen_vista_layout_day.webp',
  '/assets/gallery/type_1.webp',
  '/assets/gallery/pool.webp',
  '/assets/Zen_Vistas_Map.png',
  '/assets/markers/Zenvistas_Mappin.png',
];

function check(testName, url) {
  return new Promise(resolve => {
    http.get(`http://localhost:${PORT}${url}`, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 304) {
          const size = res.headers['content-length'] || body.length;
          console.log(`  ✅ ${testName} (${res.statusCode}, ${size} bytes)`);
          results.passed++;
        } else {
          console.log(`  ❌ ${testName} (${res.statusCode})`);
          results.failed++;
          results.errors.push(`${url} → ${res.statusCode}`);
        }
        resolve();
      });
    }).on('error', err => {
      console.log(`  ❌ ${testName} (error: ${err.message})`);
      results.failed++;
      results.errors.push(`${url} → ${err.message}`);
      resolve();
    });
  });
}

// Start server and run tests
server.listen(PORT, async () => {
  console.log(`Test server running on http://localhost:${PORT}\n`);

  console.log('=== Testing Pages ===');
  for (const page of pages) {
    const name = page === '/' ? 'index.html' : page.split('?')[0];
    await check(name, page);
  }

  console.log('\n=== Testing Assets ===');
  // Test a subset of assets
  for (const asset of assets) {
    const name = asset.split('/').pop();
    await check(name, asset);
  }

  console.log(`\n=== Results: ${results.passed} passed, ${results.failed} failed ===`);
  if (results.errors.length > 0) {
    console.log('Errors:');
    results.errors.forEach(e => console.log(`  - ${e}`));
  }

  server.close();
});
