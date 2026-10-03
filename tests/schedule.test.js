// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

const { weekStreak } = await import('../src/render/schedule.js');

// Saturday 3 Oct 2026; its week starts Monday 28 Sep.
const today = new Date(2026, 9, 3);

describe('weekStreak', () => {
  it('counts consecutive weeks with a workout, including this one', () => {
    expect(weekStreak(['2026-10-01', '2026-09-24', '2026-09-15'], today)).toBe(3);
  });

  it('does not break the streak when this week has no workout yet', () => {
    expect(weekStreak(['2026-09-24', '2026-09-15'], today)).toBe(2);
  });

  it('stops at the first week without a workout', () => {
    expect(weekStreak(['2026-10-01', '2026-09-10'], today)).toBe(1);
    expect(weekStreak([], today)).toBe(0);
  });
});
