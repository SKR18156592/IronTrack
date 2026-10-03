import { MUSCLE_GROUP_ORDER, epley1RM, getMuscleGroup } from '../model.js';
import { getHistory } from '../history-store.js';
import { esc } from '../storage.js';
import { formatTick, niceTicks } from '../chart-scale.js';

// ==========================================
// MUSCLE RECOVERY HEATMAP FEATURE
// ==========================================
const GROUP_LABEL = { chest: 'Chest', back: 'Back', legs: 'Legs', shoulders: 'Shoulders', arms: 'Arms' };

// Recovery status from days since the group was last trained (null = never).
export function recoveryStatus(days) {
  if (days === null) return { key: 'none', label: 'Not trained yet' };
  if (days < 1) return { key: 'fatigued', label: 'Fatigued' };
  if (days < 2.5) return { key: 'recovering', label: 'Recovering' };
  return { key: 'fresh', label: 'Fresh' };
}

// A stylised front/back figure; muscle shapes are tinted by status through CSS (data-status).
const BODY_BASE = `
  <circle cx="60" cy="20" r="13"/>
  <rect x="54" y="31" width="12" height="10" rx="3"/>
  <path d="M38 44 Q60 37 82 44 L86 72 Q84 104 80 132 L40 132 Q36 104 34 72 Z"/>
  <rect x="20" y="48" width="13" height="44" rx="6.5"/><rect x="87" y="48" width="13" height="44" rx="6.5"/>
  <rect x="16" y="90" width="11" height="40" rx="5.5"/><rect x="93" y="90" width="11" height="40" rx="5.5"/>
  <circle cx="21.5" cy="136" r="5.5"/><circle cx="98.5" cy="136" r="5.5"/>
  <rect x="41" y="128" width="18" height="62" rx="9"/><rect x="61" y="128" width="18" height="62" rx="9"/>
  <rect x="43" y="190" width="14" height="50" rx="7"/><rect x="63" y="190" width="14" height="50" rx="7"/>`;

const BODY_MUSCLES = {
  front: {
    shoulders: '<ellipse cx="31" cy="52" rx="9" ry="8"/><ellipse cx="89" cy="52" rx="9" ry="8"/>',
    chest: '<ellipse cx="50" cy="62" rx="11" ry="9"/><ellipse cx="70" cy="62" rx="11" ry="9"/>',
    arms: '<ellipse cx="26.5" cy="74" rx="5.5" ry="14"/><ellipse cx="93.5" cy="74" rx="5.5" ry="14"/><ellipse cx="21.5" cy="110" rx="4.5" ry="14"/><ellipse cx="98.5" cy="110" rx="4.5" ry="14"/>',
    legs: '<ellipse cx="50" cy="158" rx="7.5" ry="25"/><ellipse cx="70" cy="158" rx="7.5" ry="25"/><ellipse cx="50" cy="212" rx="5" ry="17"/><ellipse cx="70" cy="212" rx="5" ry="17"/>'
  },
  back: {
    shoulders: '<ellipse cx="31" cy="52" rx="9" ry="8"/><ellipse cx="89" cy="52" rx="9" ry="8"/>',
    back: '<path d="M48 42 L72 42 L67 58 L53 58 Z"/><path d="M41 58 Q60 52 79 58 L76 100 Q60 110 44 100 Z"/>',
    arms: '<ellipse cx="26.5" cy="74" rx="5.5" ry="14"/><ellipse cx="93.5" cy="74" rx="5.5" ry="14"/><ellipse cx="21.5" cy="110" rx="4.5" ry="14"/><ellipse cx="98.5" cy="110" rx="4.5" ry="14"/>',
    legs: '<ellipse cx="50" cy="162" rx="7.5" ry="23"/><ellipse cx="70" cy="162" rx="7.5" ry="23"/><ellipse cx="50" cy="208" rx="6" ry="17"/><ellipse cx="70" cy="208" rx="6" ry="17"/>'
  }
};

function bodyFigure(view, statusByGroup) {
  const muscles = Object.entries(BODY_MUSCLES[view])
    .map(([g, shapes]) => `<g class="muscle" data-status="${statusByGroup[g].key}"><title>${GROUP_LABEL[g]}: ${statusByGroup[g].label}</title>${shapes}</g>`)
    .join('');
  return `<figure class="body-figure">
    <svg viewBox="0 0 120 246" role="img" aria-label="${view === 'front' ? 'Front' : 'Back'} view, tinted by recovery">
      <g class="body-base">${BODY_BASE}</g>${muscles}
    </svg>
    <figcaption>${view === 'front' ? 'Front' : 'Back'}</figcaption>
  </figure>`;
}

export function renderMuscleRecoveryHeatmap() {
  const container = document.getElementById('recoveryGridContainer');
  if (!container) return;
  const history = getHistory();
  const now = new Date();

  const muscleLastTrained = {};
  MUSCLE_GROUP_ORDER.forEach(g => muscleLastTrained[g] = null);

  history.forEach(h => {
    if (!h.date || !h.exercises) return;
    const sessionDate = new Date(h.date + 'T00:00:00');
    const diffDays = (now - sessionDate) / (1000 * 60 * 60 * 24);
    h.exercises.forEach(ex => {
      const g = getMuscleGroup(ex.category);
      if (g && (muscleLastTrained[g] === null || diffDays < muscleLastTrained[g])) {
        muscleLastTrained[g] = Math.max(0, diffDays);
      }
    });
  });

  const status = {};
  MUSCLE_GROUP_ORDER.forEach(g => { status[g] = recoveryStatus(muscleLastTrained[g]); });
  const ago = (days) => days === null ? '' : days < 1 ? 'today' : `${Math.floor(days)}d ago`;

  const legend = MUSCLE_GROUP_ORDER.map(g => `
    <li class="recovery-row" data-status="${status[g].key}">
      <span class="recovery-swatch"></span>
      <span class="recovery-name">${GROUP_LABEL[g]}</span>
      <span class="recovery-status">${status[g].label}</span>
      <span class="recovery-ago">${ago(muscleLastTrained[g])}</span>
    </li>`).join('');

  const empty = history.length ? '' : '<p class="chart-empty">Log a workout to see which muscles need rest.</p>';
  container.innerHTML = `
    <div class="body-figures">${bodyFigure('front', status)}${bodyFigure('back', status)}</div>
    <ul class="recovery-legend">${legend}</ul>${empty}`;
}

// Charts with nothing to show yet point the user at the Workout tab.
function emptyState(text) {
  return `<div class="chart-empty"><p>${text}</p><button class="btn btn-secondary" onclick="showTab('workout')">Go to today's workout</button></div>`;
}

export let analyticRange = 7;
export function setAnalyticRange(days) {
  analyticRange = days;
  document.querySelectorAll('#view-analytics .range-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.range) === days));
  renderMuscleGroupBarChart();
}

export function renderMuscleGroupBarChart() {
  const wrap = document.getElementById('muscleBarChartWrap');
  if (!wrap) return;
  const data = { chest:0, back:0, legs:0, shoulders:0, arms:0 };
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - analyticRange);
  const history = getHistory().filter(h => h.date && new Date(h.date + 'T00:00:00') >= cutoff);
  history.forEach(h => {
    if (!h.exercises) return;
    h.exercises.forEach(ex => {
      const group = getMuscleGroup(ex.category);
      if (!group) return;
      ex.sets.forEach(s => {
        if (s.done === false) return;
        const w = parseFloat(s.weight), r = parseFloat(s.reps);
        if (!isNaN(w) && !isNaN(r)) data[group] += w * r;
      });
    });
  });
  const values = MUSCLE_GROUP_ORDER.map(g => data[g]);
  if (!values.some(v => v > 0)) {
    wrap.innerHTML = getHistory().length
      ? `<p class="chart-empty">No completed sets in the last ${analyticRange} days.</p>`
      : emptyState('Log your first workout to see your volume per muscle group.');
    return;
  }
  const ticks = niceTicks(0, Math.max(...values), 4);
  const max = ticks.at(-1);
  const w = 500, h = 260, pad = 40, barW = 60, gap = 28, chartH = h - pad - 60;
  const startX = (w - (MUSCLE_GROUP_ORDER.length * (barW + gap) - gap)) / 2;

  let svg = `<svg class="plate-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
  ticks.forEach(t => {
    const y = pad + chartH - (t / max) * chartH;
    svg += `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" class="chart-grid" />`;
    svg += `<text x="${pad - 8}" y="${y + 4}" text-anchor="end" class="chart-label">${formatTick(t)}</text>`;
  });
  MUSCLE_GROUP_ORDER.forEach((g, i) => {
    const val = data[g], barH = (val / max) * chartH;
    const x = startX + i * (barW + gap), y = pad + chartH - barH;
    if (val > 0) {
      svg += `<rect class="chart-bar" x="${x}" y="${y}" width="${barW}" height="${barH}" rx="8" />`;
      svg += `<text x="${x + barW/2}" y="${y - 8}" text-anchor="middle" class="chart-value">${Math.round(val).toLocaleString()} kg</text>`;
    }
    svg += `<text x="${x + barW/2}" y="${h - 24}" text-anchor="middle" class="chart-label${val > 0 ? '' : ' chart-label-muted'}">${GROUP_LABEL[g]}</text>`;
  });
  svg += `</svg>`;
  wrap.innerHTML = svg;
}

export function render1RMTrends() {
  const wrap = document.getElementById('oneRmTrendWrap');
  const select = document.getElementById('compoundSelect');
  if (!wrap) return;
  const category = select ? select.value : '';

  // The best estimated 1RM per session for the chosen lift, oldest first.
  const points = [];
  getHistory().slice().reverse().forEach(h => {
    let best = 0;
    (h.exercises || []).forEach(ex => {
      if (ex.category !== category) return;
      (ex.sets || []).forEach(s => {
        if (s.done === false || s.tag === 'Warmup') return;
        const w = parseFloat(s.weight) || 0, r = parseFloat(s.reps) || 0;
        if (w > 0 && r > 0) best = Math.max(best, epley1RM(w, r));
      });
    });
    if (best > 0) points.push({ date: h.date || '', val: best });
  });

  if (!points.length) {
    wrap.innerHTML = category
      ? '<p class="chart-empty">No logged sets for this lift yet.</p>'
      : emptyState('Log your first workout to see your strength trend.');
    return;
  }
  const latest = points.at(-1);
  if (points.length === 1) {
    wrap.innerHTML = `<div class="trend-summary"><span class="trend-latest">${latest.val.toFixed(1)} kg</span><span class="trend-delta">Log one more session to see a trend</span></div>`;
    return;
  }

  // Change over about the last four weeks (or since the first session, if that's more recent).
  const latestTime = Date.parse(latest.date) || 0;
  const base = points.find(p => (Date.parse(p.date) || 0) >= latestTime - 28 * 86400000 && p !== latest) || points.at(-2);
  const delta = latest.val - base.val;
  const days = Math.max(1, Math.round((latestTime - (Date.parse(base.date) || latestTime)) / 86400000));
  const span = days >= 14 ? `${Math.round(days / 7)} weeks` : days === 1 ? '1 day' : `${days} days`;
  const deltaText = `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} kg in ${span}`;
  const summary = `<div class="trend-summary"><span class="trend-latest">${latest.val.toFixed(1)} kg</span><span class="trend-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${deltaText}</span></div>`;

  const vals = points.map(p => p.val);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals), 3);
  const lo = ticks[0], hi = ticks.at(-1);
  const w = 520, h = 220, padL = 44, padR = 24, padT = 24, padB = 34, chartW = w - padL - padR, chartH = h - padT - padB;
  const xy = points.map((p, i) => [padL + (i / (points.length - 1)) * chartW, padT + chartH - ((p.val - lo) / (hi - lo)) * chartH]);

  let svg = `<svg class="plate-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
  ticks.forEach(t => {
    const y = padT + chartH - ((t - lo) / (hi - lo)) * chartH;
    svg += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" class="chart-grid" />`;
    svg += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" class="chart-label">${formatTick(t)}</text>`;
  });
  svg += `<polyline points="${xy.map(c => c.join(',')).join(' ')}" class="chart-line" stroke="var(--accent)" fill="none" />`;
  xy.forEach(([x, y]) => { svg += `<circle cx="${x}" cy="${y}" class="chart-point" fill="var(--accent)" />`; });
  // Up to five evenly spaced dates, always including the first and last.
  const labelCount = Math.min(5, points.length);
  const labelled = new Set(Array.from({ length: labelCount }, (_, k) => Math.round(k * (points.length - 1) / (labelCount - 1))));
  labelled.forEach(i => {
    const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
    svg += `<text x="${xy[i][0]}" y="${h - 10}" text-anchor="${anchor}" class="chart-label">${esc(String(points[i].date).slice(5))}</text>`;
  });
  const [lx, ly] = xy.at(-1);
  svg += `<text x="${lx}" y="${ly - 12}" text-anchor="end" class="chart-value">${latest.val.toFixed(1)} kg</text>`;
  svg += `</svg>`;
  wrap.innerHTML = summary + svg;
}

