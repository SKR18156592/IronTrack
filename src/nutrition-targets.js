import { getL } from './storage.js';

// Daily nutrition targets from the profile: BMR (Mifflin-St Jeor) times an activity factor gives
// maintenance calories (TDEE), adjusted for the goal. Workout days get a little more than rest days,
// with the week averaging out to the goal. Pure apart from readProfile().

export const ACTIVITY_LEVELS = [
  { value: '1.2', label: 'Sedentary (desk job, little exercise)' },
  { value: '1.375', label: 'Lightly active (1–3 days/week)' },
  { value: '1.55', label: 'Moderately active (3–5 days/week)' },
  { value: '1.725', label: 'Very active (6–7 days/week)' },
  { value: '1.9', label: 'Extremely active (athlete or physical job)' }
];
export const DEFAULT_ACTIVITY = '1.55';

// rates: kg per week. proteinPerKg: grams of protein per kg of body weight.
export const GOALS = {
  lose: { label: 'Lose fat', rates: [0.25, 0.5, 0.75], defaultRate: 0.5, proteinPerKg: 2.2 },
  maintain: { label: 'Maintain', rates: [0], defaultRate: 0, proteinPerKg: 1.8 },
  gain: { label: 'Build muscle', rates: [0.1, 0.25, 0.5], defaultRate: 0.25, proteinPerKg: 1.8 }
};
export const DEFAULT_GOAL = 'maintain';

const KCAL_PER_KG = 7700; // energy in a kg of body weight change
export const MAX_ADJUST = 1000;
const WORKOUT_DAY_SHARE = 0.06; // workout days get this much more than the daily average

const num = v => {
  const n = parseFloat(v);
  return n > 0 ? n : null;
};

// The profile as stored. Unset or invalid numbers are null: nothing is made up.
export function readProfile(get = getL) {
  const goal = GOALS[get('iron_nutrition_goal', '')] ? get('iron_nutrition_goal', '') : DEFAULT_GOAL;
  const rate = parseFloat(get('iron_nutrition_rate', ''));
  const activity = ACTIVITY_LEVELS.some(a => a.value === get('iron_profile_activity', ''))
    ? get('iron_profile_activity', '')
    : DEFAULT_ACTIVITY;
  return {
    sex: get('iron_profile_sex', 'male') === 'female' ? 'female' : 'male',
    age: num(get('iron_profile_age', '')),
    weight: num(get('iron_profile_weight', '')),
    height: num(get('iron_profile_height', '')),
    activity: Number(activity),
    goal,
    rate: GOALS[goal].rates.includes(rate) ? rate : GOALS[goal].defaultRate,
    // kcal per day added to the goal's calories (an adjustment taken from the weight trend)
    adjust: Math.max(-MAX_ADJUST, Math.min(MAX_ADJUST, Math.round(parseFloat(get('iron_nutrition_adjust', '')) || 0)))
  };
}

export const hasBodyMetrics = p => !!(p.age && p.weight && p.height);

export function bmr({ sex, age, weight, height }) {
  return 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
}

export function bmi({ weight, height }) {
  const value = weight / (height / 100) ** 2;
  const category = value < 18.5 ? 'Underweight' : value < 25 ? 'Normal' : value < 30 ? 'Overweight' : 'Obese';
  return { value, category };
}

export const tdee = p => bmr(p) * p.activity;

export const workoutDaysPerWeek = microcycle => microcycle.filter(d => d.type === 'workout').length;

export function isWorkoutDay(microcycle, date = new Date()) {
  const name = date.toLocaleDateString('en-US', { weekday: 'long' });
  return microcycle.some(d => d.type === 'workout' && d.full === name);
}

// Targets for one day. dayType: 'workout' or 'rest'. Never below BMR (floored: true when that applied).
export function dailyTargets(p, dayType, workoutDays) {
  const goal = GOALS[p.goal];
  const sign = p.goal === 'lose' ? -1 : p.goal === 'gain' ? 1 : 0;
  const maintenance = tdee(p);
  const average = maintenance + (sign * p.rate * KCAL_PER_KG) / 7 + (p.adjust || 0);
  let kcal = average;
  if (workoutDays > 0 && workoutDays < 7) {
    const extra = average * WORKOUT_DAY_SHARE;
    kcal = dayType === 'workout' ? average + extra : average - (extra * workoutDays) / (7 - workoutDays);
  }
  const floor = bmr(p);
  const floored = kcal < floor;
  kcal = Math.round(Math.max(kcal, floor));
  const protein = Math.round(p.weight * goal.proteinPerKg);
  const fat = Math.round(Math.max(0.6 * p.weight, (kcal * 0.25) / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat, maintenance: Math.round(maintenance), floored };
}

// ---- Meal plans: meals are { title, items: [[foodId, amount]] }.

export function foodNutrients(food, amount) {
  const k = amount / food.per;
  return { kcal: food.kcal * k, p: food.p * k, c: food.c * k, f: food.f * k };
}

export function sumNutrients(list) {
  return list.reduce((t, n) => ({ kcal: t.kcal + n.kcal, p: t.p + n.p, c: t.c + n.c, f: t.f + n.f }), {
    kcal: 0,
    p: 0,
    c: 0,
    f: 0
  });
}

export const mealNutrients = (meal, foods) =>
  sumNutrients(meal.items.map(([id, amt]) => foodNutrients(foods[id], amt)));
export const planNutrients = (meals, foods) => sumNutrients(meals.map(m => mealNutrients(m, foods)));

// Amounts people can actually measure: whole pieces, whole grams for small amounts, else steps of 5.
export function roundAmount(food, amount) {
  if (food.unit === 'piece') return Math.max(1, Math.round(amount));
  if (amount <= 20) return Math.max(1, Math.round(amount));
  return Math.round(amount / 5) * 5;
}

const isProteinFood = food => (food.p * 4) / food.kcal >= 0.4;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Scales a plan toward { kcal, protein }: protein-dense foods by one factor and everything else by
// another, solved so both targets are met; plain calorie scaling when that has no sensible answer.
export function scalePlan(meals, foods, target) {
  const parts = { pro: { kcal: 0, p: 0 }, other: { kcal: 0, p: 0 } };
  meals.forEach(m =>
    m.items.forEach(([id, amt]) => {
      const n = foodNutrients(foods[id], amt);
      const part = isProteinFood(foods[id]) ? parts.pro : parts.other;
      part.kcal += n.kcal;
      part.p += n.p;
    })
  );
  const { pro, other } = parts;
  const det = pro.p * other.kcal - other.p * pro.kcal;
  let a = (target.protein * other.kcal - other.p * target.kcal) / det;
  let b = (pro.p * target.kcal - target.protein * pro.kcal) / det;
  if (!isFinite(a) || !isFinite(b) || a <= 0 || b <= 0) a = b = target.kcal / (pro.kcal + other.kcal);
  a = clamp(a, 0.3, 3);
  b = clamp(b, 0.3, 3);
  const scaled = meals.map(m => ({
    ...m,
    items: m.items.map(([id, amt]) => [id, roundAmount(foods[id], amt * (isProteinFood(foods[id]) ? a : b))])
  }));
  // Rounding (whole eggs, whole bananas) adds up: let the big weighed staples (rice, oats...) absorb it.
  const isStaple = ([id, amt]) =>
    foods[id].unit !== 'piece' && !isProteinFood(foods[id]) && foodNutrients(foods[id], amt).kcal >= 100;
  const staples = scaled.flatMap(m => m.items.filter(isStaple));
  const stapleKcal = sumNutrients(staples.map(([id, amt]) => foodNutrients(foods[id], amt))).kcal;
  const off = planNutrients(scaled, foods).kcal - target.kcal;
  if (!stapleKcal) return scaled;
  const k = clamp((stapleKcal - off) / stapleKcal, 0.5, 1.5);
  return scaled.map(m => ({
    ...m,
    items: m.items.map(item => (isStaple(item) ? [item[0], roundAmount(foods[item[0]], item[1] * k)] : item))
  }));
}
