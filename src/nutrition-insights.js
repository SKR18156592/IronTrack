import { GOALS } from './nutrition-targets.js';

// Nutrition compared with what actually happens: the body-weight trend, a calorie adjustment when it
// doesn't match the goal, and the last week's eating and training. Pure functions; dates are
// 'YYYY-MM-DD' strings in local time.

const DAY_MS = 86400000;
const KCAL_PER_KG = 7700;
const dayNumber = date => {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};

// For each weigh-in, the average of the weigh-ins in the 7 days up to it (smooths out water swings).
export function movingAverage(series, days = 7) {
  return series.map(({ date }) => {
    const end = dayNumber(date);
    const window = series.filter(p => dayNumber(p.date) <= end && dayNumber(p.date) > end - days);
    return { date, kg: window.reduce((s, p) => s + p.kg, 0) / window.length };
  });
}

// kg per week over the last `windowDays` days (least squares), or null without enough data:
// at least 4 weigh-ins spanning at least 10 days.
export function weeklyRate(series, today, windowDays = 21) {
  const end = dayNumber(today);
  const pts = series.filter(p => dayNumber(p.date) > end - windowDays && dayNumber(p.date) <= end);
  if (pts.length < 4) return null;
  const xs = pts.map(p => dayNumber(p.date));
  if (Math.max(...xs) - Math.min(...xs) < 10) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = pts.reduce((a, p) => a + p.kg, 0) / pts.length;
  let num = 0,
    den = 0;
  pts.forEach((p, i) => {
    num += (xs[i] - mx) * (p.kg - my);
    den += (xs[i] - mx) ** 2;
  });
  return (num / den) * 7;
}

// The goal as kg per week: negative to lose.
export const goalRate = profile => (profile.goal === 'lose' ? -1 : profile.goal === 'gain' ? 1 : 0) * profile.rate;

// Calories per day to add (or, negative, take away) so the trend meets the goal, in steps of 50 and at
// most 500; null when the trend is within about 100 kcal a day of the goal or unknown.
export function suggestAdjustment(profile, rate) {
  if (rate === null || !GOALS[profile.goal]) return null;
  const kcal = ((goalRate(profile) - rate) * KCAL_PER_KG) / 7;
  if (Math.abs(kcal) < 100) return null;
  return Math.max(-500, Math.min(500, Math.round(kcal / 50) * 50));
}

// The 7 days up to and including `today`: days with food logged, their average calories and protein,
// protein per kg of body weight, and workouts logged.
export function weekSummary(log, history, today, weightKg) {
  const end = dayNumber(today);
  const inWeek = date => !!date && dayNumber(date) <= end && dayNumber(date) > end - 7;
  const days = new Map();
  for (const e of log) {
    if (e.type !== 'food' || !inWeek(e.date)) continue;
    const d = days.get(e.date) || { kcal: 0, p: 0 };
    d.kcal += e.kcal;
    d.p += e.p;
    days.set(e.date, d);
  }
  const n = days.size;
  const avg = key => (n ? [...days.values()].reduce((s, d) => s + d[key], 0) / n : 0);
  const protein = avg('p');
  return {
    loggedDays: n,
    kcal: avg('kcal'),
    protein,
    proteinPerKg: weightKg && n ? protein / weightKg : null,
    workouts: history.filter(h => inWeek(h.date)).length
  };
}

// 'HH:MM' shifted by `minutes`, wrapping around midnight.
export function shiftTime(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const t = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// When to eat a meal around training at `time` ('HH:MM'), judged by its name; null for other meals.
// Pre-workout: about 90 minutes before. Post-workout: within an hour of a one-hour session ending.
export function mealTiming(title, time) {
  if (!/^\d{2}:\d{2}$/.test(time || '')) return null;
  if (/pre[\s-]?workout/i.test(title)) return `around ${shiftTime(time, -90)}`;
  if (/post[\s-]?workout/i.test(title)) return `by ${shiftTime(time, 120)}`;
  return null;
}
