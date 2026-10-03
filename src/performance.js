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
// Each of `sets` is { weight, reps, rir, tag }.
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
          sets: logged.map(s => ({
            weight: num(s.weight) ?? 0,
            reps: num(s.reps),
            rir: num(s.rir),
            tag: s.tag || 'Working'
          })),
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

// ---- What to do next session (double progression): work up to the top of the rep range at a weight,
// then add weight and start again from the bottom.

// The rep range and minimum reps in reserve from a scheme like '2 × 8–12 | Rest 90s | RIR 1–2';
// null without a recognisable rep target.
export function parseScheme(scheme) {
  const reps = /[×x]\s*(\d+)(?:\s*[–-]\s*(\d+))?/.exec(scheme || '');
  if (!reps) return null;
  const lo = Number(reps[1]);
  const hi = Number(reps[2] || reps[1]);
  const rir = /RIR\s*(\d+)/i.exec(scheme);
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi), rirMin: rir ? Number(rir[1]) : 1 };
}

// About 2.5% of the weight, in steps of 1.25 kg.
export function weightStep(weight) {
  return Math.max(1.25, Math.round((weight * 0.025) / 1.25) * 1.25);
}

const roundWeight = w => Math.round(w / 1.25) * 1.25;

// Sets that say something about the working weight: not warm-ups or drop sets.
const COUNTED = s => s.reps > 0 && s.tag !== 'Warmup' && s.tag !== 'Drop Set';

// { kind: 'up' | 'reps' | 'down' | 'hold', weight, reps, why } for next time, or null without last time's
// numbers or a rep range. weight 0 is bodyweight. reps: what to aim for, e.g. '8–12' or '11+'.
export function suggestNext(entry, scheme) {
  const range = parseScheme(scheme);
  const sets = (entry?.sets || []).filter(COUNTED);
  if (!range || !sets.length) return null;
  const { lo, hi, rirMin } = range;
  const top = Math.max(...sets.map(s => s.weight));
  const topSets = sets.filter(s => s.weight === top);
  const fewest = Math.min(...topSets.map(s => s.reps));
  const span = lo === hi ? `${lo}` : `${lo}–${hi}`;

  if (topSets.every(s => s.reps >= hi)) {
    if (top === 0)
      return { kind: 'up', weight: 0, reps: span, why: `You hit ${hi}+ on every set: add weight or slow the tempo.` };
    return { kind: 'up', weight: top + weightStep(top), reps: span, why: `You hit ${hi}+ reps on every set.` };
  }
  const failedShort = topSets.filter(s => s.reps < lo && s.rir !== null && s.rir <= 0).length;
  if (top > 0 && failedShort > topSets.length / 2) {
    const lighter = Math.max(1.25, roundWeight(top * 0.95));
    return { kind: 'down', weight: lighter, reps: span, why: `Most sets ended short of ${lo} reps at failure.` };
  }
  const spare = topSets.every(s => s.reps >= lo && (s.rir === null || s.rir >= rirMin));
  if (spare)
    return {
      kind: 'reps',
      weight: top,
      reps: `${Math.min(hi, fewest + 1)}+`,
      why: 'Same weight: add a rep to each set.'
    };
  return { kind: 'hold', weight: top, reps: span, why: 'Same weight: match or beat last time.' };
}
