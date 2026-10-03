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
    let bmr = 10 * weight + 6.25 * height - 5 * age;
    bmr += sex === 'male' ? 5 : -161;
    const tdee = bmr * activity;
    res.textContent = `BMR: ${bmr.toFixed(0)} kcal | Maintenance: ${tdee.toFixed(0)} kcal`;
  } else {
    res.textContent = 'BMR: — | Maintenance: —';
  }
}

export function compute1RM() {
  const w = parseFloat(document.getElementById('calc1rmWeight').value) || 0;
  const r = parseFloat(document.getElementById('calc1rmReps').value) || 0;
  const res = document.getElementById('calc1rmResult');
  if (w > 0 && r > 0) res.textContent = `Est. 1RM: ${(r === 1 ? w : w * (1 + r / 30)).toFixed(1)} kg`;
  else res.textContent = 'Est. 1RM: —';
}

export function getPlateBreakdown(side) {
  const plates = [50, 25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
  let rem = side,
    list = [];
  plates.forEach(p => {
    let c = Math.floor(rem / p);
    while (c-- > 0) {
      list.push(p);
      rem = +(rem - p).toFixed(2);
    }
  });
  return { list, rem };
}

export function computePlates() {
  const total = parseFloat(document.getElementById('plateTargetWeight').value) || 0;
  const bar = parseFloat(document.getElementById('plateBarWeight').value) || 20;
  const res = document.getElementById('plateResultBox');
  const breakText = document.getElementById('plateBreakdownText');
  const drawing = document.getElementById('plateBarbellWrap');
  if (!total) {
    res.textContent = 'Load each side: —';
    breakText.textContent = '';
    drawing.innerHTML = '';
    return;
  }
  if (total <= bar) {
    res.textContent = 'Just the bar';
    breakText.textContent = 'The target is no more than the bar weight.';
    drawing.innerHTML = renderBarbell([]);
    return;
  }
  const side = (total - bar) / 2;
  res.textContent = `Load each side: ${+side.toFixed(2)} kg`;
  const { list, rem } = getPlateBreakdown(side);
  const counts = {};
  list.forEach(p => (counts[p] = (counts[p] || 0) + 1));
  const used = Object.keys(counts)
    .map(Number)
    .sort((a, b) => b - a)
    .map(p => `${counts[p]}× ${p} kg`);
  breakText.textContent =
    (used.length ? used.join(' • ') : '') +
    (rem > 0 ? `${used.length ? ' • ' : ''}${+rem.toFixed(2)} kg per side can't be made with standard plates` : '');
  drawing.innerHTML = renderBarbell(list);
}

// Competition plate colors and relative sizes, so the drawing matches what's on the gym floor.
const PLATE_STYLE = {
  50: ['#334155', 1, 22],
  25: ['#dc2626', 1, 18],
  20: ['#2563eb', 1, 16],
  15: ['#eab308', 0.88, 14],
  10: ['#16a34a', 0.76, 12],
  5: ['#e5e7eb', 0.58, 9],
  2.5: ['#dc2626', 0.46, 7],
  1.25: ['#94a3b8', 0.38, 6],
  0.5: ['#94a3b8', 0.3, 5]
};

// One side of the bar: sleeve, collar, and the plates from the collar outwards.
export function renderBarbell(plates) {
  const h = 120,
    mid = h / 2,
    maxPlate = 96;
  let x = 64;
  let rects = '';
  plates.forEach(p => {
    const [color, scale, width] = PLATE_STYLE[p] || ['#94a3b8', 0.3, 5];
    const ph = maxPlate * scale;
    rects += `<rect x="${x}" y="${mid - ph / 2}" width="${width}" height="${ph}" rx="2" fill="${color}"><title>${p} kg</title></rect>`;
    x += width + 2;
  });
  const end = Math.max(x + 16, 200);
  return `<svg class="plate-svg" viewBox="0 0 ${end + 8} ${h}" role="img" aria-label="Plates on one side of the bar">
    <rect x="0" y="${mid - 4}" width="${end}" height="8" rx="3" fill="#64748b" />
    <rect x="52" y="${mid - 14}" width="10" height="28" rx="2" fill="#94a3b8" />
    ${rects}
  </svg>`;
}

export function onRestMultiplierInput() {
  updateRestMultiplierLabel();
  saveSettings();
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
