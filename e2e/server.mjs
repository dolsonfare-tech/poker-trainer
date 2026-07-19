// Tiny static server for the production build — no dependencies. Serves
// `build/` with an SPA fallback to index.html, so the e2e suite runs against
// exactly what Vercel ships (a CI build with no REACT_APP_* env is
// localStorage-mode by construction, which is what the suite seeds against).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.map': 'application/json', '.txt': 'text/plain',
  '.woff2': 'font/woff2',
};

export function startServer(dir, port) {
  const server = http.createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const tryFiles = [join(dir, path), join(dir, 'index.html')];
    for (const f of tryFiles) {
      try {
        const body = await readFile(f);
        res.writeHead(200, { 'Content-Type': MIME[extname(f)] ?? 'application/octet-stream' });
        res.end(body);
        return;
      } catch { /* next */ }
    }
    res.writeHead(404); res.end('not found');
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
