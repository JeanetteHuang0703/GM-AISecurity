import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from './validate.mjs';

const site = path.join(root, 'site');
const port = Number(process.env.PORT || 4173);
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = path.resolve(site, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!target.startsWith(site + path.sep)) { response.writeHead(403).end(); return; }
    const data = await readFile(target);
    response.writeHead(200, { 'Content-Type': target.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(data);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`预览：http://127.0.0.1:${port}`));
