import { WORKOUT, rebuildWorkoutDatabase } from './model.js';
import { analyticRange, render1RMTrends, renderMuscleGroupBarChart, renderMuscleRecoveryHeatmap, setAnalyticRange } from './render/analytics.js';
import { populateCompoundSelect, populateHistoryExerciseDropdown, renderHistory } from './render/history.js';
import { renderNutritionPlan } from './render/nutrition.js';
import { loadProfileTabUI, loadProfileToCalculator } from './render/profile.js';
import { renderScheduleRibbon } from './render/schedule.js';
import { computeTDEE } from './render/tools.js';
import { activeDay, renderAll, switchDayView, updateProgress, updateSessionStats } from './render/workout.js';
import { getL, setL } from './storage.js';
import { currentUser, pullFromCloud, supabaseClient } from './sync.js';

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
  const statusEl = document.getElementById('netStatus');
  if (!statusEl) return;
  if (navigator.onLine) {
    statusEl.className = 'net-status online';
    statusEl.title = 'Online & Connected';
    if (currentUser && supabaseClient) pullFromCloud();
  } else {
    statusEl.className = 'net-status offline';
    statusEl.title = 'Offline Mode Active';
  }
}

export function refreshAllUI() {
  // If the user is currently editing an exercise or modal, don't destroy their selection
  const isModalOpen = document.getElementById('addExModalOverlay')?.classList.contains('active');
  
  rebuildWorkoutDatabase();
  
  const storedDay = getL('iron_active_day');
  const targetDay = (storedDay && WORKOUT[storedDay]) ? storedDay : (WORKOUT[activeDay] ? activeDay : Object.keys(WORKOUT)[0] || '1');

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

export function refreshHistoryUI() {
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

export function haptic(ms=15) {
  const vibe = document.getElementById('vibeToggle');
  if (vibe && vibe.checked && navigator.vibrate) navigator.vibrate(ms);
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

export function fireConfetti(opts) {
  if (typeof window.confetti === 'function') { try { window.confetti(opts); return; } catch(e){} }
}
