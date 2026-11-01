import {cp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {spawnSync} from 'node:child_process';

// Keep the regression suite's executable JavaScript/VM fixtures isolated from
// the Next.js application. No generated source is committed or served.
const root=fileURLToPath(new URL('../',import.meta.url));
const runtime=resolve(root,'.openai/local/test-runtime');
if(!runtime.startsWith(resolve(root,'.openai/local')+sep))throw Error('Invalid test output path');
await rm(runtime,{recursive:true,force:true});await mkdir(resolve(runtime,'src'),{recursive:true});
for(const name of await readdir(resolve(root,'src'))){
 if(name.endsWith('.d.ts'))continue;
 const input=resolve(root,'src',name);
 if(name.endsWith('.ts'))await writeFile(resolve(runtime,'src',name.replace(/\.ts$/,'.js')),stripTypeScriptTypes(await readFile(input,'utf8'),{mode:'strip',disableExperimentalWarning:true}));
 else await cp(input,resolve(runtime,'src',name));
}
await cp(resolve(root,'tests'),resolve(runtime,'tests'),{recursive:true});
for(const name of ['icons','manifest.json','offline.html','favicon.svg','favicon.ico','apple-touch-icon.png'])await cp(resolve(root,'public',name),resolve(runtime,name),{recursive:true});
await cp(resolve(root,'tests/fixtures/legacy-shell.html'),resolve(runtime,'index.html'));
const fixturePaths=JSON.parse(await readFile(resolve(root,'tests/fixtures/worker-paths.json'),'utf8'));
const worker=stripTypeScriptTypes(await readFile(resolve(root,'sw.ts'),'utf8'),{mode:'strip',disableExperimentalWarning:true}).replace('__SHELL_PATHS__',JSON.stringify(fixturePaths).replaceAll('"',"'"));
await writeFile(resolve(runtime,'sw.js'),worker);
await writeFile(resolve(runtime,'package.json'),'{"type":"module"}');
const tests=(await readdir(resolve(runtime,'tests'))).filter(n=>n.endsWith('.test.mjs')).map(n=>resolve(runtime,'tests',n));
const args=process.argv.slice(2);
const result=spawnSync(process.execPath,['--test',...args,...tests],{cwd:runtime,stdio:'inherit',env:{...process.env,CHORYN_SOURCE_ROOT:root}});
process.exitCode=result.status??1;
