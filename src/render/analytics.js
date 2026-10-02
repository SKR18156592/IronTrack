import { MUSCLE_GROUP_ORDER, epley1RM, getMuscleGroup } from '../model.js';
import { esc, getJ } from '../storage.js';

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
  const history = getJ('iron_workout_history', []);
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
  const history = getJ('iron_workout_history', []).filter(h => h.date && new Date(h.date + 'T00:00:00') >= cutoff);
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
    wrap.innerHTML = `<p class="chart-empty">No completed sets in the last ${analyticRange} days. Finish a workout to see volume per muscle group.</p>`;
    return;
  }
  const max = Math.max(...values, 1);
  const w = 500, h = 260, pad = 40, barW = 60, gap = 28, chartH = h - pad - 60;
  const startX = (w - (MUSCLE_GROUP_ORDER.length * (barW + gap) - gap)) / 2;

  let svg = `<svg class="plate-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
  for (let i = 0; i <= 4; i++) {
    const y = pad + chartH - (i * chartH / 4);
    svg += `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" class="chart-grid" />`;
    svg += `<text x="${pad - 8}" y="${y + 4}" text-anchor="end" class="chart-label">${(i * max / 4).toFixed(0)}</text>`;
  }
  MUSCLE_GROUP_ORDER.forEach((g, i) => {
    const val = data[g], barH = (val / max) * chartH;
    const x = startX + i * (barW + gap), y = pad + chartH - barH;
    if (val > 0) {
      svg += `<rect class="chart-bar" x="${x}" y="${y}" width="${barW}" height="${barH}" rx="8" />`;
      svg += `<text x="${x + barW/2}" y="${y - 8}" text-anchor="middle" class="chart-value">${val.toFixed(0)} kg</text>`;
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

  const history = getJ('iron_workout_history', []);
  const selectedExercise = select ? select.value : '';

  const points = [];
  history.slice().reverse().forEach(h => {
    (h.exercises || []).forEach(ex => {
      if (!selectedExercise || ex.name === selectedExercise || ex.category === selectedExercise) {
        let max1RM = 0;
        (ex.sets || []).forEach(s => {
          if (s.done !== false) {
            const w = parseFloat(s.weight) || 0;
            const r = parseFloat(s.reps) || 0;
            if (w > 0 && r > 0) {
              const est = epley1RM(w, r);
              if (est > max1RM) max1RM = est;
            }
          }
        });
        if (max1RM > 0) points.push({ date: h.date, val: max1RM, name: ex.name });
      }
    });
  });

  if (!points.length) {
    wrap.innerHTML = '<p class="chart-empty">No logged sets for this lift yet. Finish a workout to start tracking your estimated 1RM.</p>';
    return;
  }
  if (points.length === 1) {
    wrap.innerHTML = `<div class="chart-empty"><div class="chart-empty-stat">${points[0].val.toFixed(1)} kg</div>Estimated 1RM so far. Log one more session to see a trend.</div>`;
    return;
  }

  const maxVal = Math.max(...points.map(p => p.val), 20);
  const w = 520, h = 240, pad = 40, chartW = w - pad * 2, chartH = h - pad * 2;
  let svg = `<svg class="plate-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
  
  for (let i = 0; i <= 3; i++) {
    const y = pad + chartH - (i * chartH / 3);
    svg += `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" class="chart-grid" />`;
    svg += `<text x="${pad - 8}" y="${y + 4}" text-anchor="end" class="chart-label">${((maxVal * i) / 3).toFixed(0)}</text>`;
  }

  const coords = points.map((p, i) => {
    const inset = 28;
    const x = pad + inset + (i / (points.length - 1)) * (chartW - inset * 2);
    const y = pad + chartH - ((p.val / maxVal) * chartH);
    return `${x},${y}`;
  });

  if (points.length > 1) {
    svg += `<polyline points="${coords.join(' ')}" class="chart-line" stroke="var(--accent)" fill="none" />`;
  }

  // Label every point on short histories; on long ones, about six evenly spaced plus the last.
  const every = Math.max(1, Math.ceil(points.length / 6));
  points.forEach((p, i) => {
    const [x, y] = coords[i].split(',');
    const labelled = i % every === 0 || i === points.length - 1;
    svg += `<circle cx="${x}" cy="${y}" class="chart-point" fill="var(--accent)" />`;
    if (!labelled) return;
    svg += `<text x="${x}" y="${parseFloat(y) - 10}" text-anchor="middle" class="chart-value">${p.val.toFixed(1)}kg</text>`;
    svg += `<text x="${x}" y="${h - 12}" text-anchor="middle" class="chart-label">${esc(p.date ? String(p.date).slice(5) : '')}</text>`;
  });

  svg += `</svg>`;
  wrap.innerHTML = svg;
}
