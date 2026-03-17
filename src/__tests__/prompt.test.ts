import { buildMasterPrompt, buildSystemMessages } from '../utils/prompt';

describe('prompt utils', () => {
  it('builds system messages for each mode', () => {
    const master = buildMasterPrompt('french');
    const m1 = buildSystemMessages('m1', 'french');
    const m2 = buildSystemMessages('m2', 'french');
    const m3 = buildSystemMessages('m3', 'french');

    expect(master).toContain('French tutor');
    expect(Array.isArray(m1)).toBe(true);
    expect(m1[0].content).toContain('Lola');
    expect(m2[1].content).toContain('Mode 2');
    expect(m3[1].content).toContain('Mode 3');
  });
});
