import { FOODS } from './data/foods.js';
import { NUTRITION_PLANS } from './data/nutrition.js';
import { getJ, setJ } from './storage.js';

// The user's own foods and meal plans. Both are small and sync with the other settings.
//   iron_custom_foods: { [id]: { name, unit, per, kcal, p, c, f } }
//   iron_meal_plans:   { rest?: { meals }, workout?: { meals } }  (a mode left out uses the example plan)

const CUSTOM_FOODS_KEY = 'iron_custom_foods';
const MEAL_PLANS_KEY = 'iron_meal_plans';
export const UNITS = ['g', 'ml', 'piece'];
const MAX_NAME = 60;

const isNum = v => typeof v === 'number' && isFinite(v) && v >= 0;

// A food as typed by the user, cleaned up; null if it isn't usable.
export function cleanFood(raw) {
  const name = String(raw?.name ?? '')
    .trim()
    .slice(0, MAX_NAME);
  const food = {
    name,
    unit: UNITS.includes(raw?.unit) ? raw.unit : 'g',
    per: Number(raw?.per),
    kcal: Number(raw?.kcal),
    p: Number(raw?.p) || 0,
    c: Number(raw?.c) || 0,
    f: Number(raw?.f) || 0
  };
  if (!name || !(food.per > 0) || ![food.kcal, food.p, food.c, food.f].every(isNum)) return null;
  return food;
}

export function getCustomFoods() {
  const stored = getJ(CUSTOM_FOODS_KEY, {});
  const out = {};
  if (stored && typeof stored === 'object') {
    for (const [id, raw] of Object.entries(stored)) {
      const food = cleanFood(raw);
      if (food && id.startsWith('custom_')) out[id] = { ...food, custom: true };
    }
  }
  return out;
}

// Every food: the built-in catalog plus the user's own.
export const getFoods = () => ({ ...FOODS, ...getCustomFoods() });

// Returns the new food's id, or null if the food isn't valid.
export function addCustomFood(raw) {
  const food = cleanFood(raw);
  if (!food) return null;
  const id = 'custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  setJ(CUSTOM_FOODS_KEY, { ...getJ(CUSTOM_FOODS_KEY, {}), [id]: food });
  return id;
}

// Also takes the food out of any saved plan.
export function deleteCustomFood(id) {
  const stored = { ...getJ(CUSTOM_FOODS_KEY, {}) };
  delete stored[id];
  setJ(CUSTOM_FOODS_KEY, stored);
  const plans = getJ(MEAL_PLANS_KEY, {}) || {};
  for (const mode of Object.keys(plans)) {
    const meals = cleanMeals(plans[mode]?.meals, getFoods());
    if (meals) savePlan(mode, meals);
  }
}

// Meals with only known foods and positive amounts; null if the value isn't a list of meals.
function cleanMeals(meals, foods) {
  if (!Array.isArray(meals)) return null;
  return meals
    .filter(m => m && typeof m === 'object')
    .map(m => ({
      title: String(m.title ?? '').slice(0, MAX_NAME) || 'Meal',
      items: (Array.isArray(m.items) ? m.items : []).filter(
        it => Array.isArray(it) && foods[it[0]] && Number(it[1]) > 0
      )
    }));
}

export function isCustomPlan(mode) {
  return !!cleanMeals((getJ(MEAL_PLANS_KEY, {}) || {})[mode]?.meals, getFoods());
}

// The plan for 'rest' or 'workout': the user's own, or the example.
export function getPlanMeals(mode) {
  const own = cleanMeals((getJ(MEAL_PLANS_KEY, {}) || {})[mode]?.meals, getFoods());
  return own || structuredClone(NUTRITION_PLANS[mode].meals);
}

export function savePlan(mode, meals) {
  const plans = { ...(getJ(MEAL_PLANS_KEY, {}) || {}) };
  plans[mode] = { meals: cleanMeals(meals, getFoods()) || [] };
  setJ(MEAL_PLANS_KEY, plans);
}

// Back to the example plan.
export function resetPlan(mode) {
  const plans = { ...(getJ(MEAL_PLANS_KEY, {}) || {}) };
  delete plans[mode];
  setJ(MEAL_PLANS_KEY, plans);
}
