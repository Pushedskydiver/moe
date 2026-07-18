import { describe, expect, it } from 'vitest';

import { classifyConfidenceBand } from './confidence-band.js';

describe('classifyConfidenceBand', () => {
  it('classifies a score at the High floor (70) as high', () => {
    expect(classifyConfidenceBand(70)).toBe('high');
  });

  it('classifies a score above the High floor as high', () => {
    expect(classifyConfidenceBand(95)).toBe('high');
  });

  it('classifies a score at the Mid floor (35) as mid, not low', () => {
    expect(classifyConfidenceBand(35)).toBe('mid');
  });

  it('classifies a score just below the High floor (69) as mid', () => {
    expect(classifyConfidenceBand(69)).toBe('mid');
  });

  it('classifies a score in the middle of the Mid band as mid', () => {
    expect(classifyConfidenceBand(50)).toBe('mid');
  });

  it('classifies a score just below the Mid floor (34) as low', () => {
    expect(classifyConfidenceBand(34)).toBe('low');
  });

  it('classifies a score of zero as low', () => {
    expect(classifyConfidenceBand(0)).toBe('low');
  });
});
