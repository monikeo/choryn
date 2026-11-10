import {cp,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {strip,stripSources} from './runtime.ts';

// Keep the regression suite's executable JavaScript/VM fixtures isolated from
// the Next.js application. No generated source is committed or served.
const root=fileURLToPath(new URL('../',import.meta.url)),runtime=resolve(root,'.openai/local/test-runtime');
await stripSources(root,runtime);
await cp(resolve(root,'tests'),resolve(runtime,'tests'),{recursive:true});
for(const name of ['icons','manifest.json','offline.html','favicon.svg','favicon.ico','apple-touch-icon.png'])await cp(resolve(root,'public',name),resolve(runtime,name),{recursive:true});
await cp(resolve(root,'tests/fixtures/legacy-shell.html'),resolve(runtime,'index.html'));
const fixturePaths:string[]=JSON.parse(await readFile(resolve(root,'tests/fixtures/worker-paths.json'),'utf8'));
await writeFile(resolve(runtime,'sw.js'),strip(await readFile(resolve(root,'sw.ts'),'utf8')).replace('__SHELL_PATHS__',JSON.stringify(fixturePaths).replaceAll('"',"'")));
const tests=(await readdir(resolve(runtime,'tests'))).filter(name=>name.endsWith('.test.mjs')).map(name=>resolve(runtime,'tests',name));
const result=spawnSync(process.execPath,['--test',...process.argv.slice(2),...tests],{cwd:runtime,stdio:'inherit',env:{...process.env,CHORYN_SOURCE_ROOT:root}});
process.exitCode=result.status??1;
