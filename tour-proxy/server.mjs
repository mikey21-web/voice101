import http from 'http';
import https from 'https';

const PORT = process.env.PORT || 4010;
const UPSTREAM_HOST = 'hookbot.in';

// Rewrites applied to upstream HTML before serving. Only touches visible
// branding text - resource paths are left as-is because they resolve
// relative to this proxy's own path structure (see below), so they loop
// back through us automatically.
function rewriteBranding(html) {
  return html
    .split('NCD ZoneIQ').join('Vezraa Tour')
    .replace(/presented by SPIM Innovations(?: Pvt\. Ltd\.)?/g, 'presented by Vezraa');
}

// Full reverse proxy: any path under this server maps 1:1 to the same path
// on hookbot.in. This is required (not just proxying the top HTML page)
// because the tour viewer's own JS makes same-origin fetch/XHR calls to
// load room data - if only the HTML were proxied, those calls would still
// go to hookbot.in from a page whose origin is ours, and get blocked by
// CORS. Proxying every subresource keeps everything same-origin.
const server = http.createServer((req, res) => {
  const upstreamReq = https.request(
    {
      hostname: UPSTREAM_HOST,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: UPSTREAM_HOST, 'accept-encoding': 'identity' },
    },
    (upstreamRes) => {
      const contentType = upstreamRes.headers['content-type'] || '';

      if (contentType.includes('text/html')) {
        let body = '';
        upstreamRes.setEncoding('utf8');
        upstreamRes.on('data', (chunk) => (body += chunk));
        upstreamRes.on('end', () => {
          const rewritten = rewriteBranding(body);
          res.writeHead(upstreamRes.statusCode, {
            ...upstreamRes.headers,
            'content-length': Buffer.byteLength(rewritten),
          });
          res.end(rewritten);
        });
        return;
      }

      res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstreamReq.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('upstream fetch failed: ' + e.message);
  });

  req.pipe(upstreamReq);
});

server.listen(PORT, () => console.log(`tour-proxy listening on ${PORT}`));
