import { updateRestMultiplierLabel } from './workout.js';
import { getL, setL } from '../storage.js';
import { loadTheme } from '../ui.js';

export function computeTDEE() {
  const sex = document.getElementById('calcSex').value;
  const age = parseFloat(document.getElementById('calcAge').value) || 0;
  const weight = parseFloat(document.getElementById('calcWeight').value) || 0;
  const height = parseFloat(document.getElementById('calcHeight').value) || 0;
  const activity = parseFloat(document.getElementById('calcActivity').value) || 1.2;
  const res = document.getElementById('calcTdeeResult');

  if (age > 0 && weight > 0 && height > 0) {
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += (sex === 'male') ? 5 : -161;
    const tdee = bmr * activity;
    res.textContent = `BMR: ${bmr.toFixed(0)} kcal | Maintenance TDEE: ${tdee.toFixed(0)} kcal`;
  } else {
    res.textContent = `BMR: 0 kcal | Maintenance TDEE: 0 kcal`;
  }
}

export function compute1RM() {
  const w = parseFloat(document.getElementById('calc1rmWeight').value) || 0;
  const r = parseFloat(document.getElementById('calc1rmReps').value) || 0;
  const res = document.getElementById('calc1rmResult');
  if (w > 0 && r > 0) res.textContent = `Est. 1RM: ${(r === 1 ? w : w * (1 + r / 30)).toFixed(1)} kg`;
  else res.textContent = 'Est. 1RM: 0.0 kg';
}

export function getPlateBreakdown(side) {
  const plates = [50, 25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
  let rem = side, list = [];
  plates.forEach(p => {
    let c = Math.floor(rem / p);
    while (c-- > 0) { list.push(p); rem = +(rem - p).toFixed(2); }
  });
  return { list, rem };
}

export function computePlates() {
  const total = parseFloat(document.getElementById('plateTargetWeight').value) || 0;
  const bar = parseFloat(document.getElementById('plateBarWeight').value) || 20;
  const res = document.getElementById('plateResultBox');
  const breakText = document.getElementById('plateBreakdownText');
  if (total <= bar) { res.textContent = 'Load Each Side: 0.0 kg'; breakText.textContent = 'Target weight is less than bar.'; return; }
  const side = (total - bar) / 2;
  res.textContent = `Load Each Side: ${side.toFixed(2)} kg`;
  const { list, rem } = getPlateBreakdown(side);
  const counts = {};
  list.forEach(p => counts[p] = (counts[p] || 0) + 1);
  const used = Object.keys(counts).map(Number).sort((a,b)=>b-a).map(p => `${counts[p]}× ${p}kg`);
  breakText.textContent = used.length ? `Plates per side: ${used.join(' • ')}` : '';
}

export function saveSettings() {
  setL('iron_setting_sound', document.getElementById('soundToggle').checked);
  setL('iron_setting_vibe', document.getElementById('vibeToggle').checked);
  setL('iron_setting_rest_multiplier', document.getElementById('restMultiplier').value);
}

export function loadSettings() {
  document.getElementById('soundToggle').checked = getL('iron_setting_sound', 'true') === 'true';
  document.getElementById('vibeToggle').checked = getL('iron_setting_vibe', 'true') === 'true';
  document.getElementById('restMultiplier').value = getL('iron_setting_rest_multiplier', '1');
  updateRestMultiplierLabel();
  loadTheme();
}
