import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setImmediate} from 'node:timers/promises';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual client effect with a rejected/successful boot import,
// including Strict Mode's cleanup/remount cycle, without a browser network.
const source=await readFile(resolve(process.env.CHORYN_SOURCE_ROOT,'app/studio-client.tsx'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function client(fail){const effects=[],updates=[];let imports=0;const exports={};const context={exports,require:name=>{if(name==='react')return {useState:()=>[false,v=>updates.push(v)],useEffect:f=>effects.push(f)};if(name==='react/jsx-runtime')return {jsx:(tag,props)=>({tag,props}),jsxs:(tag,props)=>({tag,props}),Fragment:'fragment'};if(name==='../src/boot.js'){imports++;if(fail)throw Error('Chunk load failed');return {};}throw Error(name);}};vm.runInNewContext(code,context);return {effects,updates,render:exports.default,get imports(){return imports;}};}
test('failed initial boot chunk becomes a visible recovery state rather than an unhandled rejection',async()=>{const c=client(true);c.render();const cleanup=c.effects[0]();cleanup();c.render();c.effects[1]();await setImmediate();assert.equal(c.imports,1);assert.deepEqual(c.updates,[true]);assert.match(source,/Reload studio/);assert.match(source,/Your browser data has not been cleared/);});
test('successful boot imports only once across Strict Mode effects',async()=>{const c=client(false);c.render();c.effects[0]()();c.render();c.effects[1]();await setImmediate();assert.equal(c.imports,1);assert.deepEqual(c.updates,[]);});
test('a failed import after unmount does not update detached client state',async()=>{const c=client(true);c.render();c.effects[0]()();await setImmediate();assert.equal(c.imports,1);assert.deepEqual(c.updates,[]);});
