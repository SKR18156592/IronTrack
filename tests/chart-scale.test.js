import { describe, expect, it } from 'vitest';
import { formatTick, niceTicks } from '../src/chart-scale.js';

describe('niceTicks', () => {
  it('rounds the tonnage axis to friendly steps', () => {
    expect(niceTicks(0, 10335, 4)).toEqual([0, 3000, 6000, 9000, 12000]);
  });

  it('covers the data range with round numbers when the axis does not start at zero', () => {
    const ticks = niceTicks(53.2, 104, 3);
    expect(ticks[0]).toBeLessThanOrEqual(53.2);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(104);
    expect(ticks.every(t => t % 10 === 0)).toBe(true);
  });

  it('handles a flat series', () => {
    expect(niceTicks(80, 80, 3).length).toBeGreaterThan(1);
  });
});

describe('formatTick', () => {
  it('abbreviates thousands', () => {
    expect([0, 85, 2500, 3000, 12000].map(formatTick)).toEqual(['0', '85', '2.5k', '3k', '12k']);
  });
});
