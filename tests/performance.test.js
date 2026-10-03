import { describe, expect, it } from 'vitest';
import {
  buildPerformanceIndex,
  compareSet,
  formatSet,
  lastPerformance,
  parseScheme,
  suggestNext,
  weightStep
} from '../src/performance.js';

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
      { weight: 20, reps: 8, rir: null, tag: 'Warmup' },
      { weight: 60, reps: 8, rir: null, tag: 'Working' },
      { weight: 60, reps: 6, rir: null, tag: 'Working' }
    ]);
  });

  it('keeps equipment separate', () => {
    expect(lastPerformance(index, 'd1_incline', 'dumbbell').sets).toEqual([
      { weight: 30, reps: 10, rir: null, tag: 'Working' }
    ]);
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

describe('next-session suggestion', () => {
  const SCHEME = '2 × 8–12 | Rest 90s | RIR 1–2';
  const entry = (...sets) => ({
    sets: sets.map(([weight, reps, rir = 1, tag = 'Working']) => ({ weight, reps, rir, tag }))
  });

  it('reads the rep range and reps in reserve from the scheme', () => {
    expect(parseScheme(SCHEME)).toEqual({ lo: 8, hi: 12, rirMin: 1 });
    expect(parseScheme('3 × 15–20 + dropset | Rest 60s | RIR 0–2')).toEqual({ lo: 15, hi: 20, rirMin: 0 });
    expect(parseScheme('3 x 5')).toEqual({ lo: 5, hi: 5, rirMin: 1 });
    expect(parseScheme('2–3 × 6–10 | Rest 2–3m | RIR 1–2')).toEqual({ lo: 6, hi: 10, rirMin: 1 }); // set count first
    expect(parseScheme('Heavy, go by feel')).toBeNull();
  });

  it('adds about 2.5% once every set reaches the top of the range', () => {
    expect(suggestNext(entry([100, 12], [100, 12]), SCHEME)).toMatchObject({ kind: 'up', weight: 102.5, reps: '8–12' });
    expect(suggestNext(entry([40, 13], [40, 12]), SCHEME)).toMatchObject({ kind: 'up', weight: 41.25 });
    expect(weightStep(200)).toBe(5);
  });

  it('keeps the weight and asks for a rep more while inside the range with reps to spare', () => {
    expect(suggestNext(entry([100, 10, 2], [100, 9, 1]), SCHEME)).toMatchObject({
      kind: 'reps',
      weight: 100,
      reps: '10+'
    });
  });

  it('holds when sets went closer to failure than the scheme asks', () => {
    expect(suggestNext(entry([100, 10, 0], [100, 9, 0]), SCHEME)).toMatchObject({ kind: 'hold', weight: 100 });
  });

  it('drops about 5% when most sets fell short of the range at failure', () => {
    expect(suggestNext(entry([100, 6, 0], [100, 5, 0], [100, 8, 1]), SCHEME)).toMatchObject({
      kind: 'down',
      weight: 95
    });
  });

  it('judges the top working weight, ignoring warm-ups and drop sets', () => {
    const e = entry([60, 12, 3, 'Warmup'], [100, 12], [100, 12], [70, 15, 0, 'Drop Set']);
    expect(suggestNext(e, SCHEME)).toMatchObject({ kind: 'up', weight: 102.5 });
  });

  it('suggests reps or a harder variation for bodyweight work', () => {
    expect(suggestNext(entry([0, 12], [0, 14]), SCHEME)).toMatchObject({ kind: 'up', weight: 0 });
    expect(suggestNext(entry([0, 9], [0, 10]), SCHEME)).toMatchObject({ kind: 'reps', reps: '10+' });
  });

  it('says nothing without last time or a rep range', () => {
    expect(suggestNext(null, SCHEME)).toBeNull();
    expect(suggestNext(entry([100, 10]), 'go by feel')).toBeNull();
  });

  it('remembers reps in reserve and the tag of last time’s sets', () => {
    const index = buildPerformanceIndex([
      {
        date: '2026-10-01',
        exercises: [
          { category: 'c', variationValue: 'v', sets: [{ weight: '80', reps: '10', rir: '2', tag: 'Working' }] }
        ]
      }
    ]);
    expect(lastPerformance(index, 'c', 'v').sets).toEqual([{ weight: 80, reps: 10, rir: 2, tag: 'Working' }]);
  });
});
