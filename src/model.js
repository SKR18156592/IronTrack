import { BASE_EXERCISE_TYPES, BASE_MUSCLE_GROUP, WORKOUT_BASE } from './data/exercises.js';
import { fingerprint } from './fingerprint.js';
import { getJ, getL, isSafeId, safeId, setJ, setL } from './storage.js';
import { pushToCloud } from './sync.js';

export function getExerciseType(cat) {
  if (BASE_EXERCISE_TYPES[cat]) return BASE_EXERCISE_TYPES[cat];
  const custom = getJ('iron_custom_exercises', []).find(e => e.category === cat);
  return custom ? custom.exerciseType : 'isolation';
}

export const MUSCLE_GROUP_ORDER = ['chest', 'back', 'legs', 'shoulders', 'arms'];

// Words in an exercise's title or target that point to a muscle group. Checked in order, so the more
// specific words come first: 'rear delt row' is shoulders, 'Romanian deadlift' (hamstrings) is legs,
// 'chest-supported row' is back.
const MUSCLE_KEYWORDS = [
  ['shoulders', /delt|shoulder|overhead press|military|lateral raise|upright row|shrug|trap/],
  ['arms', /bicep|tricep|curl|brachialis|forearm|skull|pushdown|kickback/],
  ['legs', /leg|quad|hamstring|glute|calf|calves|squat|lunge|adductor|abductor|hip thrust/],
  ['back', /back|\blats?\b|\brows?\b|pull-?up|chin-?up|pulldown|deadlift/],
  ['chest', /chest|pec|bench|fly|flye|push-?up|dip/]
];

// The muscle group a custom exercise's words point to, or null (abs, cardio, or nothing recognisable).
export function guessMuscleGroup(text) {
  const t = String(text || '').toLowerCase();
  const hit = MUSCLE_KEYWORDS.find(([, re]) => re.test(t));
  return hit ? hit[0] : null;
}

// One of MUSCLE_GROUP_ORDER, or null for exercises that count toward none (abs, unknown).
export function getMuscleGroup(category) {
  if (BASE_MUSCLE_GROUP[category]) return BASE_MUSCLE_GROUP[category];
  const custom = getJ('iron_custom_exercises', []).find(e => e.category === category);
  if (!custom) return null;
  if (MUSCLE_GROUP_ORDER.includes(custom.muscleGroup)) return custom.muscleGroup;
  if (custom.muscleGroup === 'none') return null;
  return guessMuscleGroup(`${custom.title} ${custom.target}`);
}

export function getExerciseTitle(category) {
  const ex = FLAT_EXERCISES.find(e => e.category === category);
  return ex ? ex.title : category;
}
export function getRestForCategory(category) {
  const ex = FLAT_EXERCISES.find(e => e.category === category);
  return ex ? ex.rest : 75;
}
export function epley1RM(w, r) {
  return r === 1 ? w : w * (1 + r / 30);
}

// A section's element id, the same on every rebuild for the same day and title.
function sectionTag(day, title) {
  return `d${safeId(day)}_sec_` + fingerprint(String(title).toLowerCase()).replace('.', '_');
}

export let WORKOUT = {};
// built from WORKOUT_BASE by rebuildWorkoutDatabase() during init()
export let FLAT_EXERCISES = [];

// ==========================================
// EDITABLE WEEKLY MICROCYCLE
// ==========================================
const DEFAULT_MICROCYCLE = [
  { day: 'Mon', full: 'Monday', type: 'workout', dayNum: '1' },
  { day: 'Tue', full: 'Tuesday', type: 'rest', dayNum: null },
  { day: 'Wed', full: 'Wednesday', type: 'workout', dayNum: '2' },
  { day: 'Thu', full: 'Thursday', type: 'rest', dayNum: null },
  { day: 'Fri', full: 'Friday', type: 'workout', dayNum: '3' },
  { day: 'Sat', full: 'Saturday', type: 'rest', dayNum: null },
  { day: 'Sun', full: 'Sunday', type: 'rest', dayNum: null }
];

export function getMicrocycle() {
  return getJ('iron_microcycle_config', DEFAULT_MICROCYCLE);
}

export function setMicrocycle(cfg) {
  setJ('iron_microcycle_config', cfg);
  pushToCloud();
}

export function rebuildWorkoutDatabase() {
  WORKOUT = JSON.parse(JSON.stringify(WORKOUT_BASE));

  let customExsCleaned = getJ('iron_custom_exercises', []);
  let hasExChanges = false;
  customExsCleaned = customExsCleaned.filter(c => {
    if (!c.sectionTitle || c.sectionTitle === 'undefined' || c.sectionTitle === 'null') {
      c.sectionTitle = 'Custom Section';
      hasExChanges = true;
    }
    return true;
  });
  if (hasExChanges) setJ('iron_custom_exercises', customExsCleaned);

  const hiddenDays = getJ('iron_hidden_days', []);
  hiddenDays.forEach(d => {
    delete WORKOUT[d];
  });

  const customDays = getJ('iron_custom_days', []);
  customDays.forEach(cd => {
    WORKOUT[cd.dayNum] = JSON.parse(JSON.stringify(cd));
  });

  const customSecs = getJ('iron_custom_sections', []);
  customSecs.forEach(cs => {
    const dayObj = WORKOUT[cs.day];
    if (dayObj && !dayObj.sections.some(s => s.title === cs.title)) {
      dayObj.sections.push({
        title: cs.title,
        tag: cs.tag || sectionTag(cs.day, cs.title),
        color: cs.color || 'blue',
        exercises: []
      });
    }
  });

  const hiddenExs = getJ('iron_hidden_exercises', []);
  const customExs = getJ('iron_custom_exercises', []);
  const customVars = getJ('iron_custom_variations', {});
  const hiddenVars = getJ('iron_hidden_variations', {});
  const varOrderMap = getJ('iron_var_order', {});
  const sectionOrders = getJ('iron_section_orders', {});

  customExs.forEach(c => {
    const targetDayKey = String(c.day);
    const dayObj = WORKOUT[targetDayKey];
    if (dayObj) {
      let targetSec = dayObj.sections.find(s => s.title.toLowerCase() === c.sectionTitle.toLowerCase());
      if (!targetSec) {
        targetSec = {
          title: c.sectionTitle,
          tag: sectionTag(targetDayKey, c.sectionTitle),
          color: 'blue',
          exercises: []
        };
        dayObj.sections.push(targetSec);
      }
      targetSec.exercises.push({
        category: c.category,
        prefix: c.prefix,
        title: c.title,
        target: c.target,
        scheme: c.scheme,
        rest: c.rest,
        exerciseType: c.exerciseType,
        variations: [
          {
            value: 'custom_var',
            label: c.varLabel,
            setup: 'Custom setup',
            cue: 'Maintain form',
            defaultSets: [
              [20, 10, 2, 'Working'],
              [20, 10, 1, 'Working']
            ]
          }
        ]
      });
    }
  });

  Object.keys(WORKOUT).forEach(dNum => {
    WORKOUT[dNum].sections = WORKOUT[dNum].sections.filter(sec => {
      const isBadName = !sec.title || sec.title.toLowerCase() === 'undefined' || sec.title.toLowerCase() === 'null';
      return !(isBadName && (!sec.exercises || sec.exercises.length === 0));
    });

    WORKOUT[dNum].sections.forEach((sec, sIdx) => {
      sec.exercises = sec.exercises.filter(ex => !hiddenExs.includes(ex.category));
      sec.exercises.forEach(ex => {
        if (customVars[ex.category] && Array.isArray(customVars[ex.category])) {
          customVars[ex.category].forEach(v => {
            if (!ex.variations.some(existing => existing.value === v.value)) {
              ex.variations.push(v);
            }
          });
        }
        if (hiddenVars[ex.category] && Array.isArray(hiddenVars[ex.category])) {
          ex.variations = ex.variations.filter(v => !hiddenVars[ex.category].includes(v.value));
        }
        if (varOrderMap[ex.category] && Array.isArray(varOrderMap[ex.category])) {
          const order = varOrderMap[ex.category];
          ex.variations.sort((a, b) => {
            const idxA = order.indexOf(a.value);
            const idxB = order.indexOf(b.value);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });
        }
      });
      const orderKey = `iron_order_${dNum}_${sec.title.replace(/\s+/g, '_')}`;
      const savedOrder = getJ(orderKey) || getJ(`iron_order_${dNum}_${sIdx}`);
      if (savedOrder && Array.isArray(savedOrder)) {
        sec.exercises.sort((a, b) => {
          const idxA = savedOrder.indexOf(a.category);
          const idxB = savedOrder.indexOf(b.category);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
      }
    });

    if (sectionOrders[dNum] && Array.isArray(sectionOrders[dNum])) {
      const order = sectionOrders[dNum];
      WORKOUT[dNum].sections.sort((a, b) => {
        const idxA = order.indexOf(a.title);
        const idxB = order.indexOf(b.title);
        if (idxA === -1 && idxB === -1) return 0;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
    }
  });

  // Drop or repair anything whose IDs could break out of inline handlers (e.g. from an imported backup).
  Object.keys(WORKOUT).forEach(dNum => {
    if (!isSafeId(dNum)) {
      delete WORKOUT[dNum];
      return;
    }
    WORKOUT[dNum].sections.forEach(sec => {
      if (!isSafeId(sec.tag)) sec.tag = 'sec_' + safeId(sec.tag);
      if (!isSafeId(sec.color)) sec.color = 'blue';
      sec.exercises = sec.exercises.filter(ex => isSafeId(ex.category) && isSafeId(ex.prefix));
      sec.exercises.forEach(ex => {
        ex.rest = Number(ex.rest) || 75;
        ex.variations = (ex.variations || []).filter(v => isSafeId(v.value));
        if (!ex.variations.length)
          ex.variations = [{ value: 'custom_var', label: 'Standard', setup: '', cue: '', defaultSets: [] }];
      });
    });
  });

  FLAT_EXERCISES = [];
  Object.values(WORKOUT).forEach(day =>
    day.sections.forEach(sec => sec.exercises.forEach(ex => FLAT_EXERCISES.push(ex)))
  );
}

export function choiceKey(cat) {
  return 'iron_choice_master_' + cat;
}
export function presetKey(cat, varValue) {
  return 'iron_preset_' + cat + '_' + varValue;
}
export function getChoice(cat) {
  return getL(choiceKey(cat));
}
export function setChoice(cat, val) {
  setL(choiceKey(cat), val);
}
export function getPreset(cat, val) {
  return getJ(presetKey(cat, val));
}
export function setPreset(cat, val, sets) {
  setJ(presetKey(cat, val), sets);
  pushToCloud();
}

export function getDayExerciseCategories(dayNum) {
  const list = [];
  if (!WORKOUT[dayNum]) return list;
  WORKOUT[dayNum].sections.forEach(sec => {
    if (sec.exercises) sec.exercises.forEach(ex => list.push(ex.category));
  });
  return list;
}
export function getNextCategory(category) {
  const keys = Object.keys(WORKOUT);
  for (const d of keys) {
    const list = getDayExerciseCategories(d);
    const i = list.indexOf(category);
    if (i >= 0 && i < list.length - 1) return list[i + 1];
  }
  return null;
}
export function getPreviousCategory(category) {
  const keys = Object.keys(WORKOUT);
  for (const d of keys) {
    const list = getDayExerciseCategories(d);
    const i = list.indexOf(category);
    if (i > 0) return list[i - 1];
  }
  return null;
}
export function getSupersetLinks() {
  return getJ('iron_superset_links', []);
}
export function setSupersetLinks(links) {
  setJ('iron_superset_links', links);
}
export function getLinkedCategory(category) {
  for (const [a, b] of getSupersetLinks()) {
    if (a === category) return b;
    if (b === category) return a;
  }
  return null;
}
