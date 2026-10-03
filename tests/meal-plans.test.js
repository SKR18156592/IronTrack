// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { NUTRITION_PLANS } from '../src/data/nutrition.js';
import {
  addCustomFood,
  cleanFood,
  deleteCustomFood,
  getFoods,
  getPlanMeals,
  isCustomPlan,
  resetPlan,
  savePlan
} from '../src/meal-plans.js';

const paneer = { name: 'Paneer', unit: 'g', per: 100, kcal: 265, p: 18.3, c: 1.2, f: 20.8 };

beforeEach(() => localStorage.clear());

describe('custom foods', () => {
  it('rejects foods without a name, an amount or calories', () => {
    expect(cleanFood({ ...paneer, name: '  ' })).toBeNull();
    expect(cleanFood({ ...paneer, per: 0 })).toBeNull();
    expect(cleanFood({ ...paneer, kcal: NaN })).toBeNull();
    expect(cleanFood({ ...paneer, p: -1 })).toBeNull();
    expect(cleanFood({ ...paneer, unit: 'cups', p: undefined })).toMatchObject({ unit: 'g', p: 0 });
  });

  it('join the built-in foods', () => {
    const id = addCustomFood(paneer);
    expect(getFoods()[id]).toEqual({ ...paneer, custom: true });
    expect(getFoods().rice).toBeDefined();
  });

  it('ignore stored entries that are not valid foods', () => {
    localStorage.setItem('iron_custom_foods', JSON.stringify({ custom_x: { name: '' }, rice: paneer }));
    expect(Object.keys(getFoods()).filter(id => id.startsWith('custom_'))).toEqual([]);
    expect(getFoods().rice.name).toBe('White rice, cooked'); // can't replace a built-in food
  });

  it('are taken out of saved plans when deleted', () => {
    const id = addCustomFood(paneer);
    savePlan('rest', [
      {
        title: 'Lunch',
        items: [
          [id, 150],
          ['rice', 200]
        ]
      }
    ]);
    deleteCustomFood(id);
    expect(getPlanMeals('rest')).toEqual([{ title: 'Lunch', items: [['rice', 200]] }]);
  });
});

describe('meal plans', () => {
  it('use the example plan until the user saves their own', () => {
    expect(isCustomPlan('workout')).toBe(false);
    expect(getPlanMeals('workout')).toEqual(NUTRITION_PLANS.workout.meals);
    savePlan('workout', [{ title: 'Only meal', items: [['oats', 80]] }]);
    expect(isCustomPlan('workout')).toBe(true);
    expect(getPlanMeals('workout')).toEqual([{ title: 'Only meal', items: [['oats', 80]] }]);
    expect(isCustomPlan('rest')).toBe(false);
    resetPlan('workout');
    expect(getPlanMeals('workout')).toEqual(NUTRITION_PLANS.workout.meals);
  });

  it('drop unknown foods and bad amounts from stored plans', () => {
    localStorage.setItem(
      'iron_meal_plans',
      JSON.stringify({
        rest: {
          meals: [{ title: '', items: [['nope', 10], ['rice', -5], ['egg', 2], 'junk'] }, null]
        }
      })
    );
    expect(getPlanMeals('rest')).toEqual([{ title: 'Meal', items: [['egg', 2]] }]);
  });

  it('hand out copies of the example plan', () => {
    getPlanMeals('rest')[0].items.push(['rice', 999]);
    expect(getPlanMeals('rest')).toEqual(NUTRITION_PLANS.rest.meals);
  });
});
