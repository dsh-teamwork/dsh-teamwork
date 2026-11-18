import { describe, expect, it } from 'vitest';
import { phonePresets } from '../src/phone-session';
import type { PanelState } from '../src/panel';

describe('phone preset catalog', () => {
  const row={id:'team:t1:p1',name:'Review',isDefault:false};
  const state=(patch: Record<string,unknown>={})=>({presets:[{id:'p1',teamId:'t1',teamName:'Team',version:3,modelAvailable:true,tools:[],plugins:[],...patch}]} as unknown as PanelState);
  it('uses native ids and enriches only a preset from its exact team', () => {
    expect(phonePresets(state(),[row])[0]).toMatchObject({id:row.id,teamId:'t1',version:3,model:{provider:'teamwork-platform',model:'p1'},blocked:null});
    expect(phonePresets(state(),[{...row,id:'team:t2:p1'}])[0]).not.toHaveProperty('teamId');
  });
  it('passes the team preset\'s avatar to the phone, and none it did not choose', () => {
    expect(phonePresets(state({avatar:'flask'}),[row])[0].avatar).toBe('flask');
    expect(phonePresets(state(),[row])[0]).not.toHaveProperty('avatar');
  });
  it('reports unusable dependencies and preserves checks requiring a live session', () => {
    expect(phonePresets(state({plugins:[{name:'Lint',version:'1.0.0',state:'missing'}]}),[row])[0].blocked).toBe('missing_plugins');
    expect(phonePresets(state({tools:[{name:'shell',required:true,state:'missing'}]}),[row])[0].blocked).toBe('missing_tools');
    expect(phonePresets(state({tools:[{name:'shell',required:true,state:'unknown'}]}),[row])[0].blocked).toBeNull();
    expect(phonePresets(state(),[{...row,broken:'activation failed'}])[0].blocked).toBe('preset_unavailable');
  });
});
