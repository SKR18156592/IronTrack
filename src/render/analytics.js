import { MUSCLE_GROUP_COLOR, MUSCLE_GROUP_ICON, MUSCLE_GROUP_ORDER, epley1RM, getMuscleGroup } from '../model.js';
import { esc, getJ } from '../storage.js';

// ==========================================
// MUSCLE RECOVERY HEATMAP FEATURE
// ==========================================
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

  container.innerHTML = MUSCLE_GROUP_ORDER.map(g => {
    const days = muscleLastTrained[g];
    let status = 'Fully Recovered 🟢';
    let pct = 100;
    let color = 'var(--lime)';
    if (days !== null) {
      if (days < 1) { status = 'Fatigued 🔴'; pct = 20; color = 'var(--coral)'; }
      else if (days < 2.5) { status = 'Recovering 🟡'; pct = 60; color = '#fbbf24'; }
      else { status = 'Fresh 🟢'; pct = 100; color = 'var(--lime)'; }
    } else {
      status = 'Fresh 🟢';
    }
    return `
      <div class="recovery-card">
        <div style="font-size: 12.5px; font-weight: 800; text-transform: uppercase; color: var(--text);">${MUSCLE_GROUP_ICON[g]} ${g}</div>
        <div style="font-size: 11px; font-weight: 700; color: ${color};">${status}</div>
        <div class="recovery-bar-bg"><div class="recovery-bar-fill" style="width: ${pct}%; background: ${color};"></div></div>
      </div>
    `;
  }).join('');
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
    const color = MUSCLE_GROUP_COLOR[g];
    svg += `<rect class="chart-bar" x="${x}" y="${y}" width="${barW}" height="${barH}" rx="8" fill="${color}" fill-opacity="0.85" stroke="${color}" stroke-width="1.5" />`;
    svg += `<text x="${x + barW/2}" y="${y - 8}" text-anchor="middle" class="chart-value">${val.toFixed(0)} kg</text>`;
    svg += `<text x="${x + barW/2}" y="${h - 24}" text-anchor="middle" class="chart-label">${MUSCLE_GROUP_ICON[g]} ${g}</text>`;
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
    wrap.innerHTML = '<p style="color:var(--muted); text-align:center; padding:24px;">No logged lifting sets found for this lift.</p>';
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
    const x = pad + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW);
    const y = pad + chartH - ((p.val / maxVal) * chartH);
    return `${x},${y}`;
  });

  if (points.length > 1) {
    svg += `<polyline points="${coords.join(' ')}" class="chart-line" stroke="var(--accent)" fill="none" />`;
  }

  points.forEach((p, i) => {
    const [x, y] = coords[i].split(',');
    svg += `<circle cx="${x}" cy="${y}" class="chart-point" fill="var(--accent)" />`;
    svg += `<text x="${x}" y="${parseFloat(y) - 10}" text-anchor="middle" class="chart-value">${p.val.toFixed(1)}kg</text>`;
    svg += `<text x="${x}" y="${h - 12}" text-anchor="middle" class="chart-label">${esc(p.date ? String(p.date).slice(5) : '')}</text>`;
  });

  svg += `</svg>`;
  wrap.innerHTML = svg;
}
