// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

const model = await import('../src/model.js');
const { rebuildWorkoutDatabase } = model;
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const categories = (day) => model.WORKOUT[day].sections.flatMap(s => s.exercises.map(e => e.category));

beforeEach(() => localStorage.clear());

describe('rebuildWorkoutDatabase', () => {
  it('builds the default split', () => {
    rebuildWorkoutDatabase();
    expect(Object.keys(model.WORKOUT)).toEqual(expect.arrayContaining(['1', '2', '3']));
    expect(categories('1')).toContain('d1_incline');
    expect(model.FLAT_EXERCISES.length).toBeGreaterThan(10);
  });

  it('hides exercises and days', () => {
    set('iron_hidden_exercises', ['d1_incline']);
    set('iron_hidden_days', ['3']);
    rebuildWorkoutDatabase();
    expect(categories('1')).not.toContain('d1_incline');
    expect(model.WORKOUT['3']).toBeUndefined();
  });

  it('adds custom exercises to the named section, creating it if needed', () => {
    set('iron_custom_exercises', [{
      category: 'cus_1', prefix: 'cp_abc', title: 'Cable Fly', target: '', scheme: '3x12', rest: 60,
      exerciseType: 'isolation', varLabel: 'Cable', day: '1', sectionTitle: 'Finishers'
    }]);
    rebuildWorkoutDatabase();
    const sec = model.WORKOUT['1'].sections.find(s => s.title === 'Finishers');
    expect(sec.exercises.map(e => e.category)).toEqual(['cus_1']);
    expect(model.FLAT_EXERCISES.some(e => e.category === 'cus_1')).toBe(true);
  });

  it('drops entries whose ids could break out of inline handlers', () => {
    set('iron_custom_exercises', [{
      category: "x');alert(1);('", prefix: 'cp_ok', title: 'Bad', rest: 60, varLabel: 'v', day: '1', sectionTitle: 'Chest Focus'
    }]);
    set('iron_custom_days', [{ dayNum: "9'><img src=x>", title: 'Bad day', sections: [] }]);
    rebuildWorkoutDatabase();
    expect(model.FLAT_EXERCISES.some(e => e.title === 'Bad')).toBe(false);
    expect(Object.keys(model.WORKOUT).every(d => /^[A-Za-z0-9_-]+$/.test(d))).toBe(true);
  });

  it('applies the saved section order', () => {
    rebuildWorkoutDatabase();
    const titles = model.WORKOUT['1'].sections.map(s => s.title);
    set('iron_section_orders', { 1: [...titles].reverse() });
    rebuildWorkoutDatabase();
    expect(model.WORKOUT['1'].sections.map(s => s.title)).toEqual([...titles].reverse());
  });
});
