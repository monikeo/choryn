import test from 'node:test';
import assert from 'node:assert/strict';
import {installErrorHandling,configureErrorRecovery,reportError,errorHistory} from '../src/errors.js';
test('unexpected browser errors and rejected tasks invoke recovery and leave a local diagnostic',()=>{
 const listeners=new Map();let recoveries=0;const dispose=installErrorHandling({addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type,fn)=>{assert.equal(listeners.get(type),fn);listeners.delete(type);}},{notify:()=>{}});configureErrorRecovery(()=>recoveries++);
 listeners.get('error')({error:Error('A rendering operation failed')});listeners.get('unhandledrejection')({reason:Error('An export operation failed')});assert.equal(recoveries,2);assert.ok(errorHistory().some(e=>e.context==='Interrupted async operation'));dispose();assert.equal(listeners.size,0);
});
test('repeated failures are bounded, URLs are redacted and a failing recovery callback cannot cascade',()=>{
 configureErrorRecovery(()=>{throw Error('recovery callback failed');});for(let i=0;i<30;i++)reportError(Error(`Failure ${i} at https://example.test/file?token=private`),'Test');const history=errorHistory();assert.equal(history.length,20);assert.ok(history.every(e=>!e.message.includes('token=')));assert.doesNotThrow(()=>reportError(Error('Retry failed'),'Test'));configureErrorRecovery(()=>{});
});
