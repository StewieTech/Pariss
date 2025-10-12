import { buildSystemMessages, MASTER_PROMPT } from '../utils/prompt';

describe('prompt utils', () => {
  it('builds system messages for each mode', () => {
    const m1 = buildSystemMessages('m1');
    const m2 = buildSystemMessages('m2');
    const m3 = buildSystemMessages('m3');

    expect(Array.isArray(m1)).toBe(true);
    expect(m1[0].content).toContain('Lola');
    expect(m2[1].content).toContain('Mode 2');
    expect(m3[1].content).toContain('Mode 3');
  });
});
