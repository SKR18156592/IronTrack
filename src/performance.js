import { epley1RM } from './model.js';

// Past performance per exercise and equipment, from workout history (newest first). Weights on
// different equipment aren't comparable, so everything is keyed by category + variation.

const key = (category, variation) => `${category}|${variation || ''}`;
const num = v => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

// A logged set that counts: it has reps, and it isn't a warm-up.
function workingSets(exRec) {
  return (exRec.sets || [])
    .filter(s => num(s.reps) > 0 && s.tag !== 'Warmup')
    .map(s => ({ weight: num(s.weight) ?? 0, reps: num(s.reps), setNum: s.setNum }));
}

// Map of category|variation -> { date, sets (last time, all sets with reps), best (top estimated 1RM) }.
export function buildPerformanceIndex(history) {
  const index = new Map();
  for (const session of history) {
    for (const exRec of session.exercises || []) {
      if (!exRec.category) continue;
      const k = key(exRec.category, exRec.variationValue);
      const logged = (exRec.sets || []).filter(s => num(s.reps) > 0);
      if (!logged.length) continue;
      let entry = index.get(k);
      if (!entry) {
        // History is newest first, so the first match is the most recent session.
        entry = {
          date: session.date || '',
          sets: logged.map(s => ({ weight: num(s.weight) ?? 0, reps: num(s.reps) })),
          best: 0
        };
        index.set(k, entry);
      }
      for (const s of workingSets(exRec)) entry.best = Math.max(entry.best, epley1RM(s.weight, s.reps));
    }
  }
  return index;
}

export function lastPerformance(index, category, variation) {
  return index.get(key(category, variation)) || null;
}

// How a just-finished set compares: 'pr' beats the best estimated 1RM ever on this equipment,
// 'up' beats the same set last time (more weight, or the same weight for more reps).
export function compareSet(entry, setIndex, weight, reps) {
  const w = num(weight) ?? 0,
    r = num(reps);
  if (!entry || !(r > 0)) return null;
  if (entry.best > 0 && epley1RM(w, r) > entry.best + 1e-9) return 'pr';
  const last = entry.sets[setIndex];
  if (last && (w > last.weight || (w === last.weight && r > last.reps))) return 'up';
  return null;
}

export function formatSet(s) {
  return `${s.weight > 0 ? s.weight : 'BW'} × ${s.reps}`;
}
