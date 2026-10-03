import { describe, expect, it } from 'vitest';
import { buildPerformanceIndex, compareSet, formatSet, lastPerformance } from '../src/performance.js';

const set = (weight, reps, tag = 'Working') => ({ weight: String(weight), reps: String(reps), tag });
const session = (date, exercises) => ({ id: 'session_' + Date.parse(date), date, exercises });
const ex = (category, variationValue, sets) => ({ category, variationValue, sets });

// Newest first, like the stored history.
const history = [
  session('2026-09-30', [ex('d1_incline', 'smith', [set(20, 8, 'Warmup'), set(60, 8), set(60, 6)])]),
  session('2026-09-23', [ex('d1_incline', 'smith', [set(70, 5)]), ex('d1_incline', 'dumbbell', [set(30, 10)])])
];

describe('buildPerformanceIndex', () => {
  const index = buildPerformanceIndex(history);

  it('takes the most recent session as last time, warm-ups included', () => {
    const last = lastPerformance(index, 'd1_incline', 'smith');
    expect(last.date).toBe('2026-09-30');
    expect(last.sets).toEqual([
      { weight: 20, reps: 8 },
      { weight: 60, reps: 8 },
      { weight: 60, reps: 6 }
    ]);
  });

  it('keeps equipment separate', () => {
    expect(lastPerformance(index, 'd1_incline', 'dumbbell').sets).toEqual([{ weight: 30, reps: 10 }]);
    expect(lastPerformance(index, 'd1_incline', 'machine')).toBeNull();
  });

  it('tracks the best estimated 1RM across sessions, ignoring warm-ups', () => {
    // 60 x 8 -> 76, 70 x 5 -> 81.67 (Epley)
    expect(lastPerformance(index, 'd1_incline', 'smith').best).toBeCloseTo(70 * (1 + 5 / 30));
  });

  it('skips sets without reps', () => {
    const idx = buildPerformanceIndex([session('2026-10-01', [ex('d2_calf', '', [set('', '')])])]);
    expect(lastPerformance(idx, 'd2_calf', '')).toBeNull();
  });
});

describe('compareSet', () => {
  const entry = lastPerformance(buildPerformanceIndex(history), 'd1_incline', 'smith');

  it('flags a new best estimated 1RM as a PR', () => {
    expect(compareSet(entry, 1, '72.5', '5')).toBe('pr');
  });

  it('flags more weight, or more reps at the same weight, than the same set last time', () => {
    expect(compareSet(entry, 1, '62.5', '6')).toBe('up');
    expect(compareSet(entry, 2, '60', '7')).toBe('up');
  });

  it('says nothing when the set matches or falls short, or there is no history', () => {
    expect(compareSet(entry, 1, '60', '8')).toBeNull();
    expect(compareSet(entry, 1, '55', '8')).toBeNull();
    expect(compareSet(null, 0, '100', '5')).toBeNull();
    expect(compareSet(entry, 1, '60', '')).toBeNull();
  });
});

describe('formatSet', () => {
  it('shows bodyweight sets as BW', () => {
    expect(formatSet({ weight: 0, reps: 12 })).toBe('BW × 12');
    expect(formatSet({ weight: 62.5, reps: 8 })).toBe('62.5 × 8');
  });
});
