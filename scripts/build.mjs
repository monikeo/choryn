import { cp, mkdir, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=resolve(root,'dist');
if(!dist.startsWith(resolve(root)+sep))throw new Error('Unsafe build output path.');
await rm(dist, { recursive: true, force: true });
await mkdir(new URL('../dist', import.meta.url));
for (const file of ['index.html', 'favicon.svg','favicon.ico','apple-touch-icon.png', 'src','icons','manifest.json','offline.html']) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url), { recursive: true });
}
const hash=createHash('sha256');
for(const file of ['index.html','favicon.svg','favicon.ico','apple-touch-icon.png','manifest.json','offline.html','sw.js',...(await readdir(new URL('../icons/',import.meta.url))).sort().map(f=>`icons/${f}`),...(await readdir(new URL('../src/',import.meta.url))).sort().map(f=>`src/${f}`)])hash.update(await readFile(new URL(`../${file}`,import.meta.url)));
const version=hash.digest('hex').slice(0,16);
for(const file of ['index.html','offline.html'])await writeFile(new URL(`../dist/${file}`,import.meta.url),(await readFile(new URL(`../${file}`,import.meta.url),'utf8')).replaceAll('__BUILD_VERSION__',version));
const worker=await readFile(new URL('../sw.js',import.meta.url),'utf8'),shell=worker.match(/const SHELL=(\[[\s\S]*?\]);/)[1],integrity={};
for(const [,path] of shell.matchAll(/'([^']+)'/g))integrity[path]=createHash('sha256').update(await readFile(new URL(`../dist${path==='/'?'/index.html':path}`,import.meta.url))).digest('hex');
await writeFile(new URL('../dist/sw.js',import.meta.url),worker.replaceAll('__BUILD_VERSION__',version).replace('__SHELL_INTEGRITY__',JSON.stringify(integrity)));
console.log('CHORYN Studio built → dist/');
