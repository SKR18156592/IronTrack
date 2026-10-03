import { args } from '../actions.js';
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

// Anatomical front/back figure in a 120 x 246 box, symmetric about x = 60. Everything is drawn for the
// figure's right side (the viewer's left) and mirrored. Muscles are tinted by status through CSS (data-status).

// Outline of the body's right half, from the top of the head down to the crotch, using only M, L and C.
const BODY_HALF =
  'M60 4 C53 4 49 9 49 17 C49 24 51 29 54 31 L54 37 C50 40 41 42 33 44 C27 46 24 51 24 58 ' +
  'C23 70 22 84 21 98 C19 110 17 122 17 134 C16 140 16 146 18 150 C20 152 23 151 24 148 ' +
  'C25 142 25 138 26 134 C28 122 30 110 31 100 C32 90 34 78 36 67 C37 67 38 67 39 68 ' +
  'C40 80 41 92 43 104 C42 114 38 122 38 132 C37 150 38 166 40 182 C37 196 37 210 42 226 ' +
  'L41 234 C39 238 40 241 46 241 L52 241 C53 236 53 232 52 226 C54 210 55 196 53 184 ' +
  'C56 166 58 150 59 136 L60 134';

const mirrorX = (x, y) => `${+(120 - x).toFixed(2)} ${y}`;

// Closes a half outline into the whole body: the half, then its mirror image traced back up.
export function mirroredOutline(half) {
  const nums = half.match(/[A-Z]|-?[\d.]+/g);
  const segs = [];
  let start = null;
  for (let i = 0; i < nums.length;) {
    const cmd = nums[i++];
    const count = cmd === 'C' ? 3 : 1;
    const pts = [];
    for (let k = 0; k < count; k++) pts.push([+nums[i++], +nums[i++]]);
    if (cmd === 'M') start = pts[0];
    else segs.push({ cmd, from: segs.length ? segs[segs.length - 1].to : start, pts, to: pts[pts.length - 1] });
  }
  const back = segs
    .slice()
    .reverse()
    .map(({ cmd, from, pts }) =>
      cmd === 'C' ? `C${mirrorX(...pts[1])} ${mirrorX(...pts[0])} ${mirrorX(...from)}` : `L${mirrorX(...from)}`
    );
  return `${half} ${back.join(' ')} Z`;
}

const BODY_OUTLINE = mirroredOutline(BODY_HALF);

// Muscles that aren't tracked (abs, obliques), drawn for shape only.
const BODY_DETAIL = {
  front:
    '<path d="M53 80 C52 92 52 104 53 118 C55 121 57 122 59 122 L59 80 C57 79 55 79 53 80 Z"/>' +
    '<path d="M41 74 C44 84 46 96 46 110 C48 114 50 116 52 117 C51 104 51 92 52 80 C48 78 44 76 41 74 Z"/>',
  back: ''
};

const MUSCLE_PATHS = {
  front: {
    shoulders: 'M34 45 C28 46 24 51 24.5 59 C25 64 26 68 28 71 C31 64 35 58 38 54 C38 50 37 47 34 45 Z',
    chest: 'M59 50 C52 48 43 49 38 54 C35 60 36 68 39 72 C45 78 54 79 59 76 Z',
    arms:
      'M28 73 C25 80 24 90 25 98 C27 100 30 100 31 98 C33 90 34 80 35 68 C32 67 30 69 28 73 Z ' +
      'M22 104 C19 114 18 124 18 132 L25 133 C27 122 29 112 30 104 C27 101 24 101 22 104 Z',
    legs:
      'M40 136 C38 150 39 166 42 178 C45 182 50 182 53 179 C56 166 58 150 58 138 C52 134 45 133 40 136 Z ' +
      'M41 190 C39 202 40 214 43 224 L50 224 C52 212 53 200 52 190 C48 187 44 187 41 190 Z'
  },
  back: {
    // The app counts trap exercises as shoulders.
    shoulders:
      'M59 34 L54 38 C49 41 42 43 36 45 C44 48 52 55 59 80 Z ' +
      'M34 46 C28 47 24 51 24.5 59 C25 63 26 66 27 68 C30 62 33 56 37 52 C37 49 36 47 34 46 Z',
    back:
      'M38 56 C37 66 39 78 43 96 C46 99 49 101 52 102 C54 94 56 88 59 84 C54 70 46 60 38 56 Z ' +
      'M52 104 C51 107 51 110 52 113 L59 113 L59 86 C56 90 54 96 52 104 Z',
    arms:
      'M26 61 C23 70 22 84 23 96 C26 99 29 99 31 96 C33 86 34 74 35 64 C32 61 29 60 26 61 Z ' +
      'M22 104 C19 114 18 124 18 132 L25 133 C27 122 29 112 30 104 C27 101 24 101 22 104 Z',
    legs:
      'M41 117 C37 124 37 132 40 139 C46 144 54 144 59 141 L59 116 C53 114 46 114 41 117 Z ' +
      'M40 142 C39 156 40 170 42 180 C46 183 51 183 54 180 C56 168 57 156 58 144 C52 145 45 145 40 142 Z ' +
      'M41 188 C38 196 38 206 42 214 C45 216 49 216 52 214 C54 206 54 196 52 188 C48 185 44 185 41 188 Z'
  }
};

// One side's shapes, plus the same shapes mirrored onto the other side.
const bothSides = d => `<path d="${d}"/><path d="${d}" transform="matrix(-1 0 0 1 120 0)"/>`;

function bodyFigure(view, statusByGroup) {
  const muscles = Object.entries(MUSCLE_PATHS[view])
    .map(
      ([g, d]) =>
        `<g class="muscle" data-status="${statusByGroup[g].key}"><title>${GROUP_LABEL[g]}: ${statusByGroup[g].label}</title>${bothSides(d)}</g>`
    )
    .join('');
  const detail = BODY_DETAIL[view].replace(/<path d="([^"]+)"\/>/g, (_, d) => bothSides(d));
  return `<figure class="body-figure">
    <svg viewBox="0 0 120 246" role="img" aria-label="${view === 'front' ? 'Front' : 'Back'} view, tinted by recovery">
      <path class="body-base" d="${BODY_OUTLINE}"/><g class="body-detail">${detail}</g>${muscles}
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
  MUSCLE_GROUP_ORDER.forEach(g => (muscleLastTrained[g] = null));

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
  MUSCLE_GROUP_ORDER.forEach(g => {
    status[g] = recoveryStatus(muscleLastTrained[g]);
  });
  const ago = days => (days === null ? '' : days < 1 ? 'today' : `${Math.floor(days)}d ago`);

  const legend = MUSCLE_GROUP_ORDER.map(
    g => `
    <li class="recovery-row" data-status="${status[g].key}">
      <span class="recovery-swatch"></span>
      <span class="recovery-name">${GROUP_LABEL[g]}</span>
      <span class="recovery-status">${status[g].label}</span>
      <span class="recovery-ago">${ago(muscleLastTrained[g])}</span>
    </li>`
  ).join('');

  const empty = history.length ? '' : '<p class="chart-empty">Log a workout to see which muscles need rest.</p>';
  container.innerHTML = `
    <div class="body-figures">${bodyFigure('front', status)}${bodyFigure('back', status)}</div>
    <ul class="recovery-legend">${legend}</ul>${empty}`;
}

// Charts with nothing to show yet point the user at the Workout tab.
function emptyState(text) {
  return `<div class="chart-empty"><p>${text}</p><button class="btn btn-secondary" data-on-click="showTab" data-args="${args('workout')}">Go to today's workout</button></div>`;
}

export let analyticRange = 7;
export function setAnalyticRange(days) {
  analyticRange = days;
  document
    .querySelectorAll('#view-analytics .range-btn')
    .forEach(b => b.classList.toggle('active', parseInt(b.dataset.range) === days));
  renderMuscleGroupBarChart();
}

export function renderMuscleGroupBarChart() {
  const wrap = document.getElementById('muscleBarChartWrap');
  if (!wrap) return;
  const data = { chest: 0, back: 0, legs: 0, shoulders: 0, arms: 0 };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - analyticRange);
  const history = getHistory().filter(h => h.date && new Date(h.date + 'T00:00:00') >= cutoff);
  history.forEach(h => {
    if (!h.exercises) return;
    h.exercises.forEach(ex => {
      const group = getMuscleGroup(ex.category);
      if (!group) return;
      ex.sets.forEach(s => {
        if (s.done === false) return;
        const w = parseFloat(s.weight),
          r = parseFloat(s.reps);
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
  const w = 500,
    h = 260,
    pad = 40,
    barW = 60,
    gap = 28,
    chartH = h - pad - 60;
  const startX = (w - (MUSCLE_GROUP_ORDER.length * (barW + gap) - gap)) / 2;

  let svg = `<svg class="plate-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
  ticks.forEach(t => {
    const y = pad + chartH - (t / max) * chartH;
    svg += `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" class="chart-grid" />`;
    svg += `<text x="${pad - 8}" y="${y + 4}" text-anchor="end" class="chart-label">${formatTick(t)}</text>`;
  });
  MUSCLE_GROUP_ORDER.forEach((g, i) => {
    const val = data[g],
      barH = (val / max) * chartH;
    const x = startX + i * (barW + gap),
      y = pad + chartH - barH;
    if (val > 0) {
      svg += `<rect class="chart-bar" x="${x}" y="${y}" width="${barW}" height="${barH}" rx="8" />`;
      svg += `<text x="${x + barW / 2}" y="${y - 8}" text-anchor="middle" class="chart-value">${Math.round(val).toLocaleString()} kg</text>`;
    }
    svg += `<text x="${x + barW / 2}" y="${h - 24}" text-anchor="middle" class="chart-label${val > 0 ? '' : ' chart-label-muted'}">${GROUP_LABEL[g]}</text>`;
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
  getHistory()
    .slice()
    .reverse()
    .forEach(h => {
      let best = 0;
      (h.exercises || []).forEach(ex => {
        if (ex.category !== category) return;
        (ex.sets || []).forEach(s => {
          if (s.done === false || s.tag === 'Warmup') return;
          const w = parseFloat(s.weight) || 0,
            r = parseFloat(s.reps) || 0;
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
  const base =
    points.find(p => (Date.parse(p.date) || 0) >= latestTime - 28 * 86400000 && p !== latest) || points.at(-2);
  const delta = latest.val - base.val;
  const days = Math.max(1, Math.round((latestTime - (Date.parse(base.date) || latestTime)) / 86400000));
  const span = days >= 14 ? `${Math.round(days / 7)} weeks` : days === 1 ? '1 day' : `${days} days`;
  const deltaText = `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} kg in ${span}`;
  const summary = `<div class="trend-summary"><span class="trend-latest">${latest.val.toFixed(1)} kg</span><span class="trend-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${deltaText}</span></div>`;

  const vals = points.map(p => p.val);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals), 3);
  const lo = ticks[0],
    hi = ticks.at(-1);
  const w = 520,
    h = 220,
    padL = 44,
    padR = 24,
    padT = 24,
    padB = 34,
    chartW = w - padL - padR,
    chartH = h - padT - padB;
  const xy = points.map((p, i) => [
    padL + (i / (points.length - 1)) * chartW,
    padT + chartH - ((p.val - lo) / (hi - lo)) * chartH
  ]);

  let svg = `<svg class="plate-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
  ticks.forEach(t => {
    const y = padT + chartH - ((t - lo) / (hi - lo)) * chartH;
    svg += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" class="chart-grid" />`;
    svg += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" class="chart-label">${formatTick(t)}</text>`;
  });
  svg += `<polyline points="${xy.map(c => c.join(',')).join(' ')}" class="chart-line" stroke="var(--accent)" fill="none" />`;
  xy.forEach(([x, y]) => {
    svg += `<circle cx="${x}" cy="${y}" class="chart-point" fill="var(--accent)" />`;
  });
  // Up to five evenly spaced dates, always including the first and last.
  const labelCount = Math.min(5, points.length);
  const labelled = new Set(
    Array.from({ length: labelCount }, (_, k) => Math.round((k * (points.length - 1)) / (labelCount - 1)))
  );
  labelled.forEach(i => {
    const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
    svg += `<text x="${xy[i][0]}" y="${h - 10}" text-anchor="${anchor}" class="chart-label">${esc(String(points[i].date).slice(5))}</text>`;
  });
  const [lx, ly] = xy.at(-1);
  svg += `<text x="${lx}" y="${ly - 12}" text-anchor="end" class="chart-value">${latest.val.toFixed(1)} kg</text>`;
  svg += `</svg>`;
  wrap.innerHTML = summary + svg;
}
