import { WORKOUT } from './model.js';
import {
  activeDay,
  captureCurrentFormValues,
  hasStartedWorkout,
  restoreFormValues,
  startWorkoutTimer,
  switchDayView,
  workoutStartTime
} from './render/workout.js';
import { getJ, getL, setJ } from './storage.js';
import { SESSION_DRAFT_KEY } from './sync.js';

// ---- In-progress session draft. The workout form lives only in the DOM until "Save Session",
// so it is mirrored to localStorage to survive reloads, the OS killing the PWA, and re-renders.
const SESSION_DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const SESSION_META_FIELDS = ['sessionDate', 'energyLevel', 'sleepHours', 'sessionNotes'];
let draftSaveTimer = null;

export function hasSessionDraft() {
  return getL(SESSION_DRAFT_KEY, '') !== '';
}

export function saveSessionDraft() {
  clearTimeout(draftSaveTimer);
  draftSaveTimer = null;
  const meta = {};
  SESSION_META_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) meta[id] = el.value;
  });
  setJ(SESSION_DRAFT_KEY, {
    savedAt: Date.now(),
    day: activeDay,
    startTime: hasStartedWorkout ? workoutStartTime : null,
    meta,
    sets: captureCurrentFormValues()
  });
}

export function scheduleSessionDraftSave() {
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(saveSessionDraft, 300);
}

export function clearSessionDraft() {
  clearTimeout(draftSaveTimer);
  draftSaveTimer = null;
  localStorage.removeItem(SESSION_DRAFT_KEY);
}

// Call after the day views are rendered. Restores a recent draft, if any.
export function restoreSessionDraft() {
  const draft = getJ(SESSION_DRAFT_KEY, null);
  if (!draft || typeof draft !== 'object' || !(Date.now() - draft.savedAt < SESSION_DRAFT_MAX_AGE_MS)) {
    clearSessionDraft();
    return;
  }
  if (draft.day && WORKOUT[draft.day]) switchDayView(draft.day, false);
  if (draft.meta)
    SESSION_META_FIELDS.forEach(id => {
      const el = document.getElementById(id);
      if (el && typeof draft.meta[id] === 'string') el.value = draft.meta[id];
    });
  if (draft.sets && typeof draft.sets === 'object') restoreFormValues(draft.sets);
  if (Number(draft.startTime) > 0) startWorkoutTimer(Number(draft.startTime));
}

export function watchSessionForm() {
  const onChange = () => scheduleSessionDraftSave();
  const dayViews = document.getElementById('dayViews');
  ['input', 'change', 'click'].forEach(type => dayViews.addEventListener(type, onChange));
  SESSION_META_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', onChange);
      el.addEventListener('change', onChange);
    }
  });
  // Flush pending edits right away when the app is backgrounded (it may be killed after that).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && draftSaveTimer) saveSessionDraft();
  });
  window.addEventListener('pagehide', () => {
    if (draftSaveTimer) saveSessionDraft();
  });
}
