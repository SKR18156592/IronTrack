import { describe, expect, it } from 'vitest';
import {
  mealTiming,
  movingAverage,
  shiftTime,
  suggestAdjustment,
  weekSummary,
  weeklyRate
} from '../src/nutrition-insights.js';
import { dailyTargets } from '../src/nutrition-targets.js';

// Weigh-ins every other day from Sep 1, losing `perWeek` kg a week from 85 kg.
const series = (days, perWeek) =>
  Array.from({ length: Math.ceil(days / 2) }, (_, i) => ({
    date: `2026-09-${String(1 + i * 2).padStart(2, '0')}`,
    kg: 85 + (perWeek / 7) * i * 2
  }));
const profile = over => ({
  sex: 'male',
  age: 30,
  weight: 85,
  height: 180,
  activity: 1.55,
  goal: 'lose',
  rate: 0.5,
  adjust: 0,
  ...over
});

describe('weeklyRate', () => {
  it('measures the trend in kg per week', () => {
    expect(weeklyRate(series(21, -0.5), '2026-09-21')).toBeCloseTo(-0.5);
  });

  it('needs 4 weigh-ins over at least 10 days', () => {
    expect(weeklyRate(series(7, -0.5), '2026-09-07')).toBeNull();
    expect(weeklyRate(series(21, -0.5).slice(0, 3), '2026-09-21')).toBeNull();
  });

  it('only looks at the last 3 weeks', () => {
    const old = series(21, 1).map(p => ({ ...p, date: p.date.replace('2026-09', '2026-07') }));
    expect(weeklyRate([...old, ...series(21, -0.5)], '2026-09-21')).toBeCloseTo(-0.5);
  });
});

describe('movingAverage', () => {
  it('averages the weigh-ins of the last 7 days', () => {
    const avg = movingAverage([
      { date: '2026-09-01', kg: 80 },
      { date: '2026-09-03', kg: 82 },
      { date: '2026-09-09', kg: 84 }
    ]);
    expect(avg.map(p => p.kg)).toEqual([80, 81, 83]); // Sep 9 averages Sep 3–9
  });
});

describe('suggestAdjustment', () => {
  it('suggests eating less when losing slower than the goal, and more when faster', () => {
    expect(suggestAdjustment(profile(), -0.2)).toBe(-350); // 0.3 kg/week short: 330 → 350
    expect(suggestAdjustment(profile(), -0.9)).toBe(450);
  });

  it('stays quiet when on track or without a trend, and caps the change at 500', () => {
    expect(suggestAdjustment(profile(), -0.45)).toBeNull();
    expect(suggestAdjustment(profile(), null)).toBeNull();
    expect(suggestAdjustment(profile({ goal: 'gain', rate: 0.25 }), -1)).toBe(500);
  });

  it('shifts the targets once applied', () => {
    const base = dailyTargets(profile(), 'rest', 0).kcal;
    expect(dailyTargets(profile({ adjust: -350 }), 'rest', 0).kcal).toBe(base - 350);
  });
});

describe('weekSummary', () => {
  it('averages the days with food logged in the last 7 days, and counts workouts', () => {
    const food = (date, kcal, p) => ({ type: 'food', date, kcal, p });
    const log = [
      food('2026-10-04', 2000, 150),
      food('2026-10-04', 200, 10),
      food('2026-10-01', 1800, 140),
      food('2026-09-27', 5000, 300), // 8 days back
      { type: 'water', date: '2026-10-04', ml: 500 }
    ];
    const history = [{ date: '2026-10-02' }, { date: '2026-09-28' }, { date: '2026-09-20' }];
    expect(weekSummary(log, history, '2026-10-04', 80)).toEqual({
      loggedDays: 2,
      kcal: 2000,
      protein: 150,
      proteinPerKg: 1.875,
      workouts: 2
    });
  });
});

describe('meal timing', () => {
  it('places pre- and post-workout meals around the training time', () => {
    expect(mealTiming('Pre-Workout Meal', '18:00')).toBe('around 16:30');
    expect(mealTiming('post workout shake', '18:00')).toBe('by 20:00');
    expect(mealTiming('Dinner', '18:00')).toBeNull();
    expect(mealTiming('Pre-Workout Meal', '')).toBeNull();
    expect(shiftTime('00:30', -90)).toBe('23:00');
  });
});
