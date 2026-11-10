import {cp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';

// Node 22 labels type stripping experimental and has no option to silence it.
// The tools rely only on its stable "strip" mode, so keep that one notice out of
// the output (PowerShell reports any stderr line as a command error).
const emitWarning=process.emitWarning;
process.emitWarning=((warning:string|Error,...rest:unknown[])=>String(typeof warning==='string'?warning:warning.message).includes('stripTypeScriptTypes')?undefined:(emitWarning as (...args:unknown[])=>void).call(process,warning,...rest)) as typeof process.emitWarning;

export const strip=(source:string)=>stripTypeScriptTypes(source,{mode:'strip'});

/**
 * Writes an executable copy of src/ into `out` (an ignored folder under .openai/local):
 * every .ts module becomes the same file with its types removed, other files are copied.
 * Tests and the benchmark import these modules directly with Node.
 */
export async function stripSources(root:string,out:string){
  if(!out.startsWith(resolve(root,'.openai/local')+sep))throw Error('Invalid runtime output path');
  await rm(out,{recursive:true,force:true});await mkdir(resolve(out,'src'),{recursive:true});
  for(const name of await readdir(resolve(root,'src'))){
    if(name.endsWith('.d.ts'))continue;
    const input=resolve(root,'src',name);
    if(name.endsWith('.ts'))await writeFile(resolve(out,'src',name.replace(/\.ts$/,'.js')),strip(await readFile(input,'utf8')));
    else await cp(input,resolve(out,'src',name));
  }
  await writeFile(resolve(out,'package.json'),'{"type":"module"}');
}
