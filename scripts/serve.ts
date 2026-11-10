import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

// Previews the exported Next.js site in dist/ (run `npm run build` first). Use `npm run dev` for hot reload.
const root=resolve(fileURLToPath(new URL('../',import.meta.url)),'dist');
const port=Number(process.env.PORT||4173);
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff'};
http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url||'/','http://localhost').pathname);
    if(pathname.split('/').some(part=>part.startsWith('.')&&part!=='.')){res.writeHead(403).end();return;}
    const path=resolve(root,`.${pathname==='/'?'/index.html':pathname==='/offline'?'/offline.html':pathname}`);
    if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}
    const data=await readFile(path);
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(data);
  }catch{res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`CHORYN Studio: http://127.0.0.1:${port}`));
