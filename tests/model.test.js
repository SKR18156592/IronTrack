// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

const model = await import('../src/model.js');
const { rebuildWorkoutDatabase } = model;
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const categories = day => model.WORKOUT[day].sections.flatMap(s => s.exercises.map(e => e.category));

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
    set('iron_custom_exercises', [
      {
        category: 'cus_1',
        prefix: 'cp_abc',
        title: 'Cable Fly',
        target: '',
        scheme: '3x12',
        rest: 60,
        exerciseType: 'isolation',
        varLabel: 'Cable',
        day: '1',
        sectionTitle: 'Finishers'
      }
    ]);
    rebuildWorkoutDatabase();
    const sec = model.WORKOUT['1'].sections.find(s => s.title === 'Finishers');
    expect(sec.exercises.map(e => e.category)).toEqual(['cus_1']);
    expect(model.FLAT_EXERCISES.some(e => e.category === 'cus_1')).toBe(true);
  });

  it('drops entries whose ids could break out of inline handlers', () => {
    set('iron_custom_exercises', [
      {
        category: "x');alert(1);('",
        prefix: 'cp_ok',
        title: 'Bad',
        rest: 60,
        varLabel: 'v',
        day: '1',
        sectionTitle: 'Chest Focus'
      }
    ]);
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

describe('section tags', () => {
  it('gives created sections the same tag on every rebuild', () => {
    set('iron_custom_sections', [{ day: '1', title: 'Pump Work', color: 'blue' }]);
    set('iron_custom_exercises', [
      { category: 'cus_1', prefix: 'cp_a', title: 'Fly', rest: 60, varLabel: 'v', day: '2', sectionTitle: 'Extras' }
    ]);
    const tags = () => ['1', '2'].map(d => model.WORKOUT[d].sections.find(s => /Pump Work|Extras/.test(s.title)).tag);
    rebuildWorkoutDatabase();
    const first = tags();
    rebuildWorkoutDatabase();
    expect(tags()).toEqual(first);
    expect(first.every(t => /^[A-Za-z0-9_-]+$/.test(t))).toBe(true);
    expect(first[0]).not.toBe(first[1]);
  });
});

describe('getMuscleGroup', () => {
  const custom = (fields, day = '2') =>
    set('iron_custom_exercises', [
      { category: 'cus_1', prefix: 'cp_a', rest: 60, varLabel: 'v', day, sectionTitle: 'Extras', ...fields }
    ]);

  it('uses the catalog for built-in exercises', () => {
    expect(model.getMuscleGroup('d1_incline')).toBe('chest');
    expect(model.getMuscleGroup('d3_trap')).toBe('shoulders');
  });

  it('uses the group chosen for a custom exercise, whatever day it is on', () => {
    custom({ title: 'Machine thing', target: '', muscleGroup: 'back' }, '1');
    expect(model.getMuscleGroup('cus_1')).toBe('back');
    custom({ title: 'Plank', target: 'Core', muscleGroup: 'none' });
    expect(model.getMuscleGroup('cus_1')).toBeNull();
  });

  it('guesses from the title and target when no group was chosen, not from the day', () => {
    custom({ title: 'Cable Fly', target: 'Chest' }, '2');
    expect(model.getMuscleGroup('cus_1')).toBe('chest');
    custom({ title: 'Romanian Deadlift', target: 'Hamstrings & Glutes' }, '1');
    expect(model.getMuscleGroup('cus_1')).toBe('legs');
    custom({ title: 'Hanging Knee Raise', target: 'Abs' });
    expect(model.getMuscleGroup('cus_1')).toBeNull();
  });

  it('guesses sensibly for tricky names', () => {
    expect(model.guessMuscleGroup('Rear delt row')).toBe('shoulders');
    expect(model.guessMuscleGroup('Chest-supported row')).toBe('back');
    expect(model.guessMuscleGroup('Narrow grip bench press')).toBe('chest');
    expect(model.guessMuscleGroup('Lateral raise')).toBe('shoulders');
    expect(model.guessMuscleGroup('Tricep dip')).toBe('arms');
  });

  it('counts deleted custom exercises toward no group', () => {
    expect(model.getMuscleGroup('cus_gone')).toBeNull();
  });
});
