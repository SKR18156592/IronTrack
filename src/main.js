import { FLAT_EXERCISES, WORKOUT, getChoice, rebuildWorkoutDatabase, setChoice } from './model.js';
import { renderNutritionPlan } from './render/nutrition.js';
import { loadProfileData, loadProfileTabUI, shrinkStoredAvatar } from './render/profile.js';
import { renderScheduleRibbon } from './render/schedule.js';
import { compute1RM, computePlates, computeTDEE, loadSettings } from './render/tools.js';
import { applyVariation, renderAll, switchDayView } from './render/workout.js';
import { restoreSessionDraft, watchSessionForm } from './session-draft.js';
import { getHistory, loadHistory } from './history-store.js';
import { getL } from './storage.js';
import { currentUser, pullFromCloud, startSessionSync, supabaseClient } from './sync.js';
import { showTab, unlockAudio, updateOnlineStatus } from './ui.js';
import { hydrateIcons } from './icons.js';
import * as ui from './ui.js';
import * as sync from './sync.js';
import * as analytics from './render/analytics.js';
import * as exercises from './render/exercises.js';
import * as history from './render/history.js';
import * as nutrition from './render/nutrition.js';
import * as profile from './render/profile.js';
import * as schedule from './render/schedule.js';
import * as shareCard from './render/share-card.js';
import * as tools from './render/tools.js';
import * as workout from './render/workout.js';

// The markup and rendered templates use inline on* handlers that call functions by name.
for (const mod of [ui, sync, analytics, exercises, history, nutrition, profile, schedule, shareCard, tools, workout]) {
  for (const [name, value] of Object.entries(mod)) {
    if (typeof value === 'function') window[name] = value;
  }
}

window.addEventListener('online', updateOnlineStatus);

window.addEventListener('offline', updateOnlineStatus);

window.addEventListener('focus', () => {
  if (currentUser && supabaseClient) pullFromCloud(false);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentUser && supabaseClient) {
    pullFromCloud(false);
  }
});

// Fallback in case a realtime event is missed.
setInterval(() => {
  if (currentUser && supabaseClient && navigator.onLine) {
    pullFromCloud(false);
  }
}, 30000);

async function init() {
  await loadHistory();
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

  document.querySelectorAll('.bottom-tab').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));
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
      val = (foundLastVar && ex.variations.some(v => v.value === foundLastVar)) ? foundLastVar : ex.variations[0].value;
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
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // The bundled JS/CSS (hashed file names) loaded before the worker controlled this page,
        // so hand it the URLs to cache for offline use.
        const urls = performance.getEntriesByType('resource')
          .map(e => e.name)
          .filter(u => new URL(u).origin === location.origin);
        if (reg.active) reg.active.postMessage({ type: 'CACHE_URLS', urls });
      })
      .catch(err => console.warn('Service worker registration failed:', err));
  });
}
