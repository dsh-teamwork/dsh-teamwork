import { describe, expect, it } from 'vitest';
import { checkFilters } from '../src/assistant-tools.js';

describe('assistant read filters', () => {
  it('takes the names the server reads for a period of usage', () => {
    expect(() => checkFilters('usage', { since: '2026-11-01T00:00:00Z', until: '2026-12-01T00:00:00Z' })).not.toThrow();
    expect(() => checkFilters('export', { since: '2026-11-01T00:00:00Z', userId: 'u1' })).not.toThrow();
    expect(() => checkFilters('submissions', { state: 'pending' })).not.toThrow();
  });
  it('refuses a filter the route would silently ignore, naming the ones it takes', () => {
    expect(() => checkFilters('usage', { from: '2026-11-01' })).toThrow(/usage takes no filter from; it takes userId, configId, since, until/);
    expect(() => checkFilters('budgets', { since: '2026-11-01' })).toThrow(/it takes none/);
  });
});
