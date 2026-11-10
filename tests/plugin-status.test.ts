import { expect, test } from 'vitest';
import { pluginState } from '../src/plugin-status.js';
const bundle={version:'1.0.0',availability:'profile',enabled:true,rows:[{entryId:'e'}]};
const active=[{entryId:'e',enabled:true,fiberPhase:'active'}];
test('plugin inventory distinguishes missing, disabled, incompatible version and failed loading',()=>{
  expect(pluginState('1.0.0',undefined,[])).toBe('missing');
  expect(pluginState('1.0.0',{...bundle,availability:'missing'},active)).toBe('missing');
  expect(pluginState('1.0.0',{...bundle,enabled:false},active)).toBe('disabled');
  expect(pluginState('2.0.0',bundle,active)).toBe('version-mismatch');
  expect(pluginState('1.0.0',{...bundle,error:{code:'failed'}},active)).toBe('failed');
  expect(pluginState('1.0.0',bundle,[{...active[0],fiberPhase:'failed'}])).toBe('failed');
});
test('installed or selected does not imply ready; restart and empty runtime inventory remain explicit',()=>{
  expect(pluginState('1.0.0',bundle,active)).toBe('ready');
  expect(pluginState('1.0.0',bundle,active,true)).toBe('pending');
  expect(pluginState('1.0.0',bundle,[])).toBe('pending');
  expect(pluginState('1.0.0',bundle,[{...active[0],enabled:false}])).toBe('pending');
  expect(pluginState('1.0.0',{...bundle,rows:[]},active)).toBe('unknown');
});
