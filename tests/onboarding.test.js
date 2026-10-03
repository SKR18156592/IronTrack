// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

const { scheduleWithDays } = await import('../src/render/onboarding.js');

const WEEK = [
  { day: 'Mon', full: 'Monday', type: 'workout', dayNum: '1' },
  { day: 'Tue', full: 'Tuesday', type: 'rest', dayNum: null },
  { day: 'Wed', full: 'Wednesday', type: 'workout', dayNum: '2' },
  { day: 'Thu', full: 'Thursday', type: 'rest', dayNum: null },
  { day: 'Fri', full: 'Friday', type: 'workout', dayNum: '3' }
];
const summary = cycle => cycle.map(d => `${d.day}:${d.type === 'workout' ? d.dayNum : '-'}`).join(' ');

describe('scheduleWithDays', () => {
  it('leaves the schedule alone when the training days stay the same', () => {
    const custom = WEEK.map(d => (d.day === 'Mon' ? { ...d, dayNum: '3' } : d));
    expect(scheduleWithDays(custom, ['Monday', 'Wednesday', 'Friday'], ['1', '2', '3'])).toBe(custom);
  });

  it('deals the plan’s workouts out in weekday order when the days change', () => {
    expect(summary(scheduleWithDays(WEEK, ['Tuesday', 'Thursday', 'Friday'], ['1', '2', '3']))).toBe(
      'Mon:- Tue:1 Wed:- Thu:2 Fri:3'
    );
    expect(
      summary(scheduleWithDays(WEEK, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], ['1', '2', '3']))
    ).toBe('Mon:1 Tue:2 Wed:3 Thu:1 Fri:2');
  });

  it('can make every day a rest day', () => {
    expect(scheduleWithDays(WEEK, [], ['1']).every(d => d.type === 'rest' && d.dayNum === null)).toBe(true);
  });
});
