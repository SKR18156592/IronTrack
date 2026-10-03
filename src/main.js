import { FLAT_EXERCISES, WORKOUT, getChoice, rebuildWorkoutDatabase, setChoice } from './model.js';
import { renderNutritionPlan } from './render/nutrition.js';
import { loadProfileData, loadProfileTabUI, shrinkStoredAvatar } from './render/profile.js';
import { renderScheduleRibbon } from './render/schedule.js';
import { compute1RM, computePlates, computeTDEE, loadSettings } from './render/tools.js';
import { applyVariation, renderAll, switchDayView } from './render/workout.js';
import { restoreSessionDraft, watchSessionForm } from './session-draft.js';
import { getHistory, loadHistory } from './history-store.js';
import { loadNutritionLog } from './nutrition-log.js';
import { getL, onStorageFailure } from './storage.js';
import { currentUser, pullFromCloud, startSessionSync, supabaseClient } from './sync.js';
import { showTab, showToast, unlockAudio, updateOnlineStatus } from './ui.js';
import { hydrateIcons } from './icons.js';
import { listenForActions, registerActions } from './actions.js';
import * as ui from './ui.js';
import * as sync from './sync.js';
import * as analytics from './render/analytics.js';
import * as exercises from './render/exercises.js';
import * as history from './render/history.js';
import * as nutrition from './render/nutrition.js';
import * as nutritionLog from './render/nutrition-log.js';
import * as profile from './render/profile.js';
import * as schedule from './render/schedule.js';
import * as shareCard from './render/share-card.js';
import * as tools from './render/tools.js';
import * as workout from './render/workout.js';

onStorageFailure(message => showToast(message, 'error'));

// The markup and rendered templates name these modules' functions in data-on-* attributes.
registerActions([
  ui,
  sync,
  analytics,
  exercises,
  history,
  nutrition,
  nutritionLog,
  profile,
  schedule,
  shareCard,
  tools,
  workout
]);
listenForActions();

window.addEventListener('online', updateOnlineStatus);

window.addEventListener('offline', updateOnlineStatus);

// Coming back to the app usually fires both focus and visibilitychange; one pull covers both.
let lastReturnPullAt = 0;
function pullOnReturn() {
  if (!currentUser || !supabaseClient || Date.now() - lastReturnPullAt < 2000) return;
  lastReturnPullAt = Date.now();
  pullFromCloud(false);
}

window.addEventListener('focus', pullOnReturn);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') pullOnReturn();
});

// Fallback in case a realtime event is missed. Not while the app is in the background:
// coming back pulls anyway.
setInterval(() => {
  if (currentUser && supabaseClient && navigator.onLine && document.visibilityState === 'visible') {
    pullFromCloud(false);
  }
}, 30000);

async function init() {
  await Promise.all([loadHistory(), loadNutritionLog()]);
  hydrateIcons();
  loadSettings();
  loadProfileData();
  loadProfileTabUI();
  shrinkStoredAvatar();
  rebuildWorkoutDatabase();
  renderAll();
  renderScheduleRibbon();
  renderNutritionPlan();
  computeTDEE();
  compute1RM();
  computePlates();
  updateOnlineStatus();
  document.getElementById('sessionDate').valueAsDate = new Date();

  document
    .querySelectorAll('.bottom-tab')
    .forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));
  document.addEventListener('click', () => unlockAudio());

  FLAT_EXERCISES.forEach(ex => {
    const sel = document.getElementById(ex.category + 'Select');
    if (!sel) return;

    let val = getChoice(ex.category);
    if (!val || !ex.variations.some(v => v.value === val)) {
      const history = getHistory();
      let foundLastVar = null;
      for (const rec of history) {
        if (!rec.exercises) continue;
        for (const exRec of rec.exercises) {
          if (exRec.category === ex.category && exRec.variationValue) {
            foundLastVar = exRec.variationValue;
            break;
          }
        }
        if (foundLastVar) break;
      }
      val = foundLastVar && ex.variations.some(v => v.value === foundLastVar) ? foundLastVar : ex.variations[0].value;
      setChoice(ex.category, val);
    }

    sel.value = val;
    applyVariation(ex.category, ex.prefix, val, true);
  });

  const savedDay = getL('iron_active_day', '1');
  if (savedDay && WORKOUT[savedDay]) switchDayView(savedDay, false);
  else {
    const firstAvailable = Object.keys(WORKOUT)[0] || '1';
    switchDayView(firstAvailable, false);
  }

  restoreSessionDraft();
  watchSessionForm();

  startSessionSync();
}

init();

// ==========================================
// PWA: SERVICE WORKER REGISTRATION
// ==========================================
// The worker is built from src/sw.js by `npm run build`; the dev server doesn't serve one.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker registration failed:', err));
  });
}
