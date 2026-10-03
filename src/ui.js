import { WORKOUT, rebuildWorkoutDatabase } from './model.js';
import {
  analyticRange,
  render1RMTrends,
  renderMuscleGroupBarChart,
  renderMuscleRecoveryHeatmap,
  setAnalyticRange
} from './render/analytics.js';
import { populateCompoundSelect, populateHistoryExerciseDropdown, renderHistory } from './render/history.js';
import { renderNutritionPlan } from './render/nutrition.js';
import { loadProfileTabUI, loadProfileToCalculator } from './render/profile.js';
import { renderHomeSummary, renderScheduleRibbon } from './render/schedule.js';
import { computeTDEE } from './render/tools.js';
import { activeDay, renderAll, switchDayView, updateProgress, updateSessionStats } from './render/workout.js';
import { getL, setL } from './storage.js';
import { currentUser, isSyncDirty, pullFromCloud, supabaseClient } from './sync.js';
import { icon } from './icons.js';

// ==========================================
// TOAST NOTIFICATIONS & NETWORK TRACKER
// ==========================================
export function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('active'), 10);
  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export function updateOnlineStatus() {
  updateSyncIndicator();
  if (navigator.onLine && currentUser && supabaseClient) pullFromCloud();
}

// The dot on the header avatar (and on the profile screen): synced, waiting to upload, offline,
// or signed out (data stays on this device).
export function updateSyncIndicator() {
  let state, label;
  if (!currentUser || !supabaseClient) {
    state = 'local';
    label = 'Not signed in: data stays on this device';
  } else if (!navigator.onLine) {
    state = 'offline';
    label = 'Offline: changes are saved on this device';
  } else if (isSyncDirty()) {
    state = 'pending';
    label = 'Changes waiting to sync';
  } else {
    state = 'synced';
    label = 'All changes synced';
  }
  document.querySelectorAll('.sync-dot').forEach(dot => {
    dot.dataset.state = state;
    dot.title = label;
  });
  const text = document.getElementById('syncStatusText');
  if (text) text.textContent = label;
  const btn = document.getElementById('profileToggleBtn');
  if (btn) btn.setAttribute('aria-label', `Profile. ${label}`);
}

export function refreshAllUI() {
  // If the user is currently editing an exercise or modal, don't destroy their selection
  const isModalOpen = document.getElementById('addExModalOverlay')?.classList.contains('active');

  rebuildWorkoutDatabase();

  const storedDay = getL('iron_active_day');
  const targetDay =
    storedDay && WORKOUT[storedDay] ? storedDay : WORKOUT[activeDay] ? activeDay : Object.keys(WORKOUT)[0] || '1';

  if (!isModalOpen) {
    renderAll();
    renderScheduleRibbon();
    switchDayView(targetDay, false);
  }

  renderHistory();
  updateProgress();
  updateSessionStats();
  if (typeof render1RMTrends === 'function') render1RMTrends();
  if (typeof renderMuscleGroupBarChart === 'function') renderMuscleGroupBarChart();
  if (typeof renderMuscleRecoveryHeatmap === 'function') renderMuscleRecoveryHeatmap();
}

export function refreshNutritionUI() {
  renderNutritionPlan();
}

export function refreshHistoryUI() {
  renderHomeSummary();
  renderHistory();
  populateHistoryExerciseDropdown();
  populateCompoundSelect();
  render1RMTrends();
  renderMuscleGroupBarChart();
  renderMuscleRecoveryHeatmap();
}

// ==========================================
// THEME ENGINE
// ==========================================
export function changeTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  setL('iron_theme', themeName);
  const sel = document.getElementById('themeSelect');
  if (sel) sel.value = themeName;
}
export function loadTheme() {
  const t = getL('iron_theme', 'cyan');
  changeTheme(t);
}
let audioCtx = null;
let lastActiveTabBeforeProfile = 'workout';

export function haptic(ms = 15) {
  const vibe = document.getElementById('vibeToggle');
  if (vibe && vibe.checked && navigator.vibrate) navigator.vibrate(ms);
}

// Edit mode shows the controls for restructuring the plan (reorder, remove, add exercises, sections,
// days); outside it the workout screen only shows what you need while lifting. Not persisted:
// the app always opens ready to log.
export function toggleEditMode() {
  const on = document.body.classList.toggle('edit-mode');
  const btn = document.getElementById('editModeBtn');
  if (btn) {
    btn.innerHTML = `${icon(on ? 'check' : 'pencil', 14)} <span class="edit-toggle-label">${on ? 'Done' : 'Edit'}</span>`;
    btn.setAttribute('aria-pressed', String(on));
  }
}

export function showTab(tab) {
  const profileActive = document.getElementById('view-profile').classList.contains('active');
  if (tab !== 'profile' && profileActive) {
    lastActiveTabBeforeProfile = tab;
  }
  document.querySelectorAll('.bottom-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.app-view').forEach(v => v.classList.toggle('active', v.id === 'view-' + tab));

  if (tab === 'analytics') {
    setAnalyticRange(analyticRange);
    renderMuscleRecoveryHeatmap();
    render1RMTrends();
  } else if (tab === 'nutrition') {
    renderNutritionPlan();
  } else if (tab === 'tools') {
    loadProfileToCalculator();
    computeTDEE();
  } else if (tab === 'profile') {
    loadProfileTabUI();
  }
}

export function toggleProfileTab() {
  const profileView = document.getElementById('view-profile');
  const isProfileActive = profileView.classList.contains('active');

  if (isProfileActive) {
    showTab(lastActiveTabBeforeProfile || 'workout');
  } else {
    const currentActiveView = document.querySelector('.app-view.active');
    if (currentActiveView && currentActiveView.id !== 'view-profile') {
      lastActiveTabBeforeProfile = currentActiveView.id.replace('view-', '');
    }
    document.querySelectorAll('.bottom-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
    profileView.classList.add('active');
    loadProfileTabUI();
  }
}

export function unlockAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}
}

export function playBeep() {
  if (!document.getElementById('soundToggle').checked) return;
  try {
    unlockAudio();
    const now = audioCtx.currentTime;
    [0, 0.15, 0.3].forEach((delay, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(i === 2 ? 880 : 660, now + delay);
      gain.gain.setValueAtTime(0.3, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.12);
    });
  } catch (e) {}
}

// Loaded on first use: it's only needed when a session is saved.
export function fireConfetti(opts) {
  import('canvas-confetti').then(({ default: confetti }) => confetti(opts)).catch(() => {});
}

export function selectText(input) {
  input.select();
}
export function closeClosestModal(el) {
  el.closest('.modal-overlay')?.remove();
}
export function closeCelebration() {
  document.getElementById('celebrationOverlay').classList.remove('active');
}
