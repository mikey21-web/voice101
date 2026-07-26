import http from 'http';
import https from 'https';

const PORT = process.env.PORT || 4010;
const UPSTREAM_BASE = 'https://hookbot.in/viewer/index.php';

// Rewrites applied to the upstream HTML before serving. Only touches the
// visible branding text - asset/base URLs (window.base_url, window.s3_url,
// hookbot.in resource links) are left untouched so the tour itself still
// loads its images/scripts from hookbot's real domain.
function rewriteBranding(html) {
  return html
    .split('NCD ZoneIQ').join('Vezraa Tour')
    .split('presented by SPIM Innovations Pvt. Ltd.').join('presented by Vezraa');
}

function fetchUpstream(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUpstream(new URL(res.headers.location, url).toString()).then(resolve, reject);
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (reqUrl.pathname !== '/viewer') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }

  const code = reqUrl.searchParams.get('code');
  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('missing code param');
    return;
  }

  const upstreamUrl = new URL(UPSTREAM_BASE);
  upstreamUrl.searchParams.set('code', code);
  const room = reqUrl.searchParams.get('room');
  if (room) upstreamUrl.searchParams.set('room', room);

  try {
    const { status, body } = await fetchUpstream(upstreamUrl.toString());
    let html = rewriteBranding(body);
    // Relative resource paths in the upstream page resolve against
    // hookbot.in, not our domain, since we're now serving this HTML
    // ourselves.
    html = html.replace('<head>', '<head>\n<base href="https://hookbot.in/viewer/">');
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('upstream fetch failed: ' + e.message);
  }
});

server.listen(PORT, () => console.log(`tour-proxy listening on ${PORT}`));
