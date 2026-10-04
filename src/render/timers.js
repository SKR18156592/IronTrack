import { getL } from '../storage.js';
import { playBeep } from '../ui.js';

// The session timer (starts with the first set touched) and the rest timer between sets.

export let hasStartedWorkout = false;
export let workoutStartTime = null;
let workoutTimerInterval = null;
let restInterval = null;

export function getRestMultiplier() {
  const m = parseFloat(getL('iron_setting_rest_multiplier', '1'));
  return isNaN(m) ? 1 : Math.max(0.5, Math.min(2.0, m));
}
export function updateRestMultiplierLabel() {
  const val = document.getElementById('restMultiplier')?.value || '1';
  const label = document.getElementById('restMultiplierValue');
  if (label) label.textContent = parseFloat(val).toFixed(2) + 'x';
}

export function checkStartWorkoutTimer() {
  if (!hasStartedWorkout) startWorkoutTimer(Date.now());
}

export function startWorkoutTimer(startTime) {
  hasStartedWorkout = true;
  workoutStartTime = startTime;
  clearInterval(workoutTimerInterval);
  const tick = () => {
    const elapsed = Math.max(0, Math.floor((Date.now() - workoutStartTime) / 1000));
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    document.getElementById('timeElapsed').textContent = `${h}:${m}:${s}`;
  };
  tick();
  workoutTimerInterval = setInterval(tick, 1000);
}

export function resetWorkoutTimer() {
  hasStartedWorkout = false;
  workoutStartTime = null;
  clearInterval(workoutTimerInterval);
  document.getElementById('timeElapsed').textContent = '00:00:00';
}

export function startRestTimer(seconds) {
  clearInterval(restInterval);
  const modal = document.getElementById('restModal');
  const display = document.getElementById('restTimerDisplay');
  modal.classList.add('active');
  const end = Date.now() + seconds * 1000;
  function tick() {
    const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    display.textContent = `${m}:${s}`;
    if (remaining <= 0) {
      clearInterval(restInterval);
      modal.classList.remove('active');
      playBeep();
    }
  }
  tick();
  restInterval = setInterval(tick, 250);
}

export function cancelRestTimer() {
  clearInterval(restInterval);
  document.getElementById('restModal').classList.remove('active');
}
