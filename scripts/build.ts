import {cp,mkdir,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,relative,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';

// Node 22 labels type stripping experimental and has no option to silence it.
// The build relies only on its stable "strip" mode, so keep that one notice
// out of the output (PowerShell reports any stderr line as a command error).
const emitWarning=process.emitWarning;
process.emitWarning=((warning:string|Error,...rest:unknown[])=>String(typeof warning==='string'?warning:warning.message).includes('stripTypeScriptTypes')?undefined:(emitWarning as (...args:unknown[])=>void).call(process,warning,...rest)) as typeof process.emitWarning;

const root=fileURLToPath(new URL('../',import.meta.url)),dist=resolve(root,'dist');
const walk=async(dir:string):Promise<string[]>=>(await Promise.all((await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name)).map(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]))).flat();
if(!dist.startsWith(resolve(root)+sep))throw Error('Invalid build output path.');
// The build version is a hash of every input, so any source or config change gets a new offline cache.
const configs=['package-lock.json','package.json','next.config.ts','tsconfig.json','tsconfig.worker.json','tsconfig.scripts.json','tsconfig.strict.json','sw.ts'];
const inputs=[...await walk(resolve(root,'src')),...await walk(resolve(root,'app')),...await walk(resolve(root,'public')),...configs.map(name=>resolve(root,name)),fileURLToPath(import.meta.url)];
const hash=createHash('sha256');for(const file of inputs.sort()){hash.update(relative(root,file));hash.update(await readFile(file));}
const version=hash.digest('hex').slice(0,16);
const run=(args:string[])=>{const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',CHORYN_BUILD:version}});if(r.status!==0)process.exit(r.status??1);};
// Type checks: the app, the service worker, the tooling scripts and the strict-mode modules.
for(const project of ['tsconfig.json','tsconfig.worker.json','tsconfig.scripts.json','tsconfig.strict.json'])run(['node_modules/typescript/bin/tsc','--noEmit','-p',project]);
run(['node_modules/next/dist/bin/next','build','--webpack']);
await rm(dist,{recursive:true,force:true});await cp(resolve(root,'out'),dist,{recursive:true});
await mkdir(resolve(dist,'src'),{recursive:true});
for(const file of ['mediabunny.NOTICE.txt','mediabunny.LICENSE.txt'])await cp(resolve(root,'src',file),resolve(dist,'src',file));
const offline=resolve(dist,'offline.html');await writeFile(offline,(await readFile(offline,'utf8')).replaceAll('__BUILD_VERSION__',version));
// Sites canonicalizes generated error-page URLs. Those pages are never needed
// to launch the editor offline; precache the app routes and runtime assets.
const files=await walk(dist),paths=['/','/index.html','/offline',...files.map(file=>'/'+relative(dist,file).split(sep).join('/'))].filter((path,index,list)=>list.indexOf(path)===index&&!/^\/(?:404|_not-found)(?:[/.]|$)/.test(path));
const integrity:Record<string,string>={};for(const path of paths){const file=path==='/'?resolve(dist,'index.html'):path==='/offline'?offline:resolve(dist,'.'+path);integrity[path]=createHash('sha256').update(await readFile(file)).digest('hex');}
const worker=stripTypeScriptTypes(await readFile(resolve(root,'sw.ts'),'utf8'),{mode:'strip'}).replaceAll('__BUILD_VERSION__',version).replace('__SHELL_PATHS__',JSON.stringify(paths)).replace('__SHELL_INTEGRITY__',JSON.stringify(integrity));
await writeFile(resolve(dist,'sw.js'),worker);
await mkdir(resolve(root,'.openai/local'),{recursive:true});await writeFile(resolve(root,'.openai/local/next-build.json'),JSON.stringify({version,output:'Next.js static export',files:files.length+1,offlineEntries:paths.length},null,2));
console.log('CHORYN Next.js build '+version+' → dist/ · '+paths.length+' verified offline entries');
