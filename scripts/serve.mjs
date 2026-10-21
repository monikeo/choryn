import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import {fileURLToPath} from 'node:url';
const built=process.argv.includes('--built');
const root = resolve(fileURLToPath(new URL('../',import.meta.url)),built?'dist':'.');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png':'image/png', '.ico':'image/x-icon' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if(pathname==='/sw.js'&&!built){res.writeHead(404).end('Service worker is enabled in built preview only.');return;}
    if(pathname.split('/').some(part=>part.startsWith('.')&&part!=='.')){res.writeHead(403).end();return;}
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname === '/offline' ? '/offline.html' : pathname}`);
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': `${types[extname(path)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-cache','X-Content-Type-Options':'nosniff' });
    res.end(data);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`CHORYN Studio: http://127.0.0.1:${port}`));
