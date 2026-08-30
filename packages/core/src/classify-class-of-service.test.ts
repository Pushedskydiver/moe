import { describe, expect, it } from 'vitest';

import { classifyClassOfService } from './classify-class-of-service.js';

describe('classifyClassOfService', () => {
  it('returns Standard when neither condition holds', () => {
    expect(
      classifyClassOfService(
        { channelId: 'C_WORK_CHANNEL', severity: 'Medium' },
        'C_INCIDENTS',
      ),
    ).toBe('Standard');
  });

  it('returns Expedite when the channel is the incidents channel', () => {
    expect(
      classifyClassOfService(
        { channelId: 'C_INCIDENTS', severity: 'Low' },
        'C_INCIDENTS',
      ),
    ).toBe('Expedite');
  });

  it('returns Expedite when severity is Critical', () => {
    expect(
      classifyClassOfService(
        { channelId: 'C_WORK_CHANNEL', severity: 'Critical' },
        'C_INCIDENTS',
      ),
    ).toBe('Expedite');
  });

  it('returns Expedite when both conditions hold (OR, not XOR)', () => {
    expect(
      classifyClassOfService(
        { channelId: 'C_INCIDENTS', severity: 'Critical' },
        'C_INCIDENTS',
      ),
    ).toBe('Expedite');
  });

  it('defaults the incidents channel id to INCIDENTS_CHANNEL_ID', () => {
    expect(
      classifyClassOfService({
        channelId: 'C0B9AS89QSH',
        severity: 'Low',
      }),
    ).toBe('Expedite');
  });
});
