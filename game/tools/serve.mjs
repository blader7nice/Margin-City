// Minimal static server for dist/ with production-like caching (hashed assets immutable, html no-cache)
// and on-the-fly gzip, so cold vs warm-cache loads can be measured realistically.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webp': 'image/webp', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };

export function serve(root, port = 0) {
  const srv = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(root, url === '/' ? 'index.html' : url);
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      const ext = path.extname(file);
      const headers = { 'content-type': TYPES[ext] ?? 'application/octet-stream' };
      headers['cache-control'] = ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable';
      const accepts = String(req.headers['accept-encoding'] ?? '');
      if ((ext === '.js' || ext === '.html') && accepts.includes('gzip')) {
        data = zlib.gzipSync(data, { level: 9 });
        headers['content-encoding'] = 'gzip';
      }
      headers['content-length'] = data.length;
      res.writeHead(200, headers);
      res.end(data);
    });
  });
  return new Promise((resolve) => srv.listen(port, '127.0.0.1', () => resolve(srv)));
}

if (process.argv[1] && process.argv[1].endsWith('serve.mjs')) {
  const root = path.resolve(process.argv[2] ?? 'dist');
  const port = Number(process.argv[3] ?? 4173);
  serve(root, port).then(() => console.log(`serving ${root} on http://127.0.0.1:${port}`));
}
