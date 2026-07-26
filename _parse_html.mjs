import fs from 'fs';
const html = fs.readFileSync('./docs/spim-analysis/deep/page.html', 'utf8');
const bodyStart = html.indexOf('<body');
const bodyEnd = html.indexOf('</body>');
const body = html.substring(bodyStart, bodyEnd);

// Find all id attributes - use a simpler approach
const idRegex = /id="([^"]+)"/g;
let m;
const ids = [];
while ((m = idRegex.exec(body)) !== null) ids.push(m[1]);
console.log('Body IDs:', ids.join(', '));
console.log('Total IDs:', ids.length);

// Find all button texts
const btnRegex = /<button[^>]*>([^<]+)<\/button>/g;
const btns = [];
while ((m = btnRegex.exec(body)) !== null) btns.push(m[1].trim());
console.log('Buttons:', JSON.stringify(btns));
