import { describe, expect, it } from 'vitest';
import { FOODS } from '../src/data/foods.js';
import { NUTRITION_PLANS } from '../src/data/nutrition.js';
import {
  bmr,
  dailyTargets,
  hasBodyMetrics,
  isWorkoutDay,
  planNutrients,
  readProfile,
  roundAmount,
  scalePlan
} from '../src/nutrition-targets.js';

const profile = over => ({
  sex: 'male',
  age: 23,
  weight: 72.5,
  height: 175,
  activity: 1.55,
  goal: 'maintain',
  rate: 0,
  ...over
});
const store = values => key => values[key] ?? '';
const WEEK = [
  { full: 'Monday', type: 'workout' },
  { full: 'Tuesday', type: 'rest' },
  { full: 'Wednesday', type: 'workout' }
];

describe('readProfile', () => {
  it('leaves unset metrics empty instead of making them up', () => {
    const p = readProfile(store({}));
    expect([p.age, p.weight, p.height]).toEqual([null, null, null]);
    expect(hasBodyMetrics(p)).toBe(false);
    expect(p).toMatchObject({ sex: 'male', activity: 1.55, goal: 'maintain', rate: 0 });
  });

  it('falls back to the goal’s default rate when the stored rate does not fit the goal', () => {
    expect(readProfile(store({ iron_nutrition_goal: 'lose', iron_nutrition_rate: '0.1' })).rate).toBe(0.5);
    expect(readProfile(store({ iron_nutrition_goal: 'gain', iron_nutrition_rate: '0.1' })).rate).toBe(0.1);
    expect(readProfile(store({ iron_nutrition_goal: 'bogus' })).goal).toBe('maintain');
  });
});

describe('dailyTargets', () => {
  it('uses Mifflin-St Jeor for BMR', () => {
    expect(bmr(profile())).toBeCloseTo(1708.75);
    expect(bmr(profile({ sex: 'female' }))).toBeCloseTo(1542.75);
  });

  it('gives workout days more, averaging out to the goal over the week', () => {
    const p = profile({ goal: 'lose', rate: 0.5 });
    const workout = dailyTargets(p, 'workout', 3);
    const rest = dailyTargets(p, 'rest', 3);
    expect(workout.kcal).toBeGreaterThan(rest.kcal);
    expect((3 * workout.kcal + 4 * rest.kcal) / 7).toBeCloseTo(workout.maintenance - 550, -1);
  });

  it('splits the calories into protein by body weight, fat, and carbs for the rest', () => {
    const t = dailyTargets(profile({ goal: 'lose', rate: 0.5 }), 'rest', 0);
    expect(t.protein).toBe(Math.round(72.5 * 2.2));
    expect(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal)).toBeLessThan(5);
  });

  it('never goes below BMR', () => {
    const p = profile({ sex: 'female', weight: 50, height: 155, age: 40, activity: 1.2, goal: 'lose', rate: 0.75 });
    const t = dailyTargets(p, 'rest', 3);
    expect(t.floored).toBe(true);
    expect(t.kcal).toBe(Math.round(bmr(p)));
  });
});

describe('isWorkoutDay', () => {
  it('reads the weekday from the schedule', () => {
    expect(isWorkoutDay(WEEK, new Date(2026, 9, 5))).toBe(true); // a Monday
    expect(isWorkoutDay(WEEK, new Date(2026, 9, 6))).toBe(false);
    expect(isWorkoutDay(WEEK, new Date(2026, 9, 11))).toBe(false); // Sunday: not in the schedule
  });
});

describe('meal plans', () => {
  it('still add up to the totals the original plans listed', () => {
    expect(Math.round(planNutrients(NUTRITION_PLANS.rest.meals, FOODS).kcal)).toBe(2283);
    expect(Math.round(planNutrients(NUTRITION_PLANS.workout.meals, FOODS).kcal)).toBe(2537);
  });

  it('only use foods that exist', () => {
    for (const plan of Object.values(NUTRITION_PLANS)) {
      for (const meal of plan.meals) for (const [id] of meal.items) expect(FOODS[id], id).toBeDefined();
    }
  });

  it.each([
    ['a small cut', { kcal: 1700, protein: 130 }],
    ['maintenance', { kcal: 2500, protein: 150 }],
    ['a large bulk', { kcal: 3300, protein: 175 }]
  ])('scale to %s within 2% on calories and 5% on protein', (_, target) => {
    const scaled = scalePlan(NUTRITION_PLANS.workout.meals, FOODS, target);
    const n = planNutrients(scaled, FOODS);
    expect(Math.abs(n.kcal - target.kcal) / target.kcal).toBeLessThan(0.02);
    expect(Math.abs(n.p - target.protein) / target.protein).toBeLessThan(0.05);
  });

  it('round amounts to something you can measure', () => {
    expect(roundAmount(FOODS.egg, 3.4)).toBe(3);
    expect(roundAmount(FOODS.egg, 0.2)).toBe(1);
    expect(roundAmount(FOODS.ghee, 3.6)).toBe(4);
    expect(roundAmount(FOODS.rice, 233)).toBe(235);
  });
});

describe('scaling the rest-day plan for real profiles', () => {
  it.each([
    ['an 85 kg man cutting', profile({ age: 30, weight: 85, height: 180, goal: 'lose', rate: 0.5 })],
    ['a 55 kg woman maintaining', profile({ sex: 'female', age: 28, weight: 55, height: 160 })],
    ['a 95 kg man bulking', profile({ age: 25, weight: 95, height: 188, activity: 1.725, goal: 'gain', rate: 0.25 })]
  ])('lands close to the targets for %s', (_, p) => {
    const t = dailyTargets(p, 'rest', 3);
    const n = planNutrients(scalePlan(NUTRITION_PLANS.rest.meals, FOODS, t), FOODS);
    expect(Math.abs(n.kcal - t.kcal) / t.kcal).toBeLessThan(0.02);
    expect(Math.abs(n.p - t.protein) / t.protein).toBeLessThan(0.08);
  });
});
