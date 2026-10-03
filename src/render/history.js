import { confirmDialog } from '../dialog.js';
import { args } from '../actions.js';
import { sessionKey } from '../history-merge.js';
import { WORKOUT } from '../model.js';
import { HISTORY_KEY, HISTORY_TOMBSTONES_KEY, clearHistory, getHistory, setHistory } from '../history-store.js';
import { NUTRITION_LOG_KEY, getNutritionLog, setNutritionLog } from '../nutrition-log.js';
import { esc, getJ, setJ } from '../storage.js';
import { currentUser, pushToCloud, supabaseClient } from '../sync.js';
import { refreshAllUI, showTab, showToast } from '../ui.js';
import { icon } from '../icons.js';
import { activeDay } from './workout.js';

export function populateHistoryDayFilter() {
  const select = document.getElementById('historyDayFilter');
  if (!select) return;
  const curr = select.value;
  let html = `<option value="">All Days / Splits</option>`;
  Object.keys(WORKOUT).forEach(d => {
    html += `<option value="${d}">Day ${d}: ${esc(WORKOUT[d].title.replace('⚡ ', ''))}</option>`;
  });
  select.innerHTML = html;
  select.value = curr;
}

// ==========================================
// PR / MILESTONE DETECTION & 1RM LOGIC
// ==========================================
export function calculateMaxWeightsPerExercise() {
  const history = getHistory();
  const maxMap = {};
  history
    .slice()
    .reverse()
    .forEach(h => {
      if (h.exercises) {
        h.exercises.forEach(ex => {
          const cat = ex.category || ex.name;
          if (!cat) return;
          ex.sets.forEach(s => {
            if (s.done === false) return;
            const w = parseFloat(s.weight) || 0;
            if (w > 0) {
              if (maxMap[cat] === undefined || w > maxMap[cat]) {
                maxMap[cat] = w;
              }
            }
          });
        });
      }
    });
  return maxMap;
}

export function onHistoryDayFilterChange() {
  populateHistoryExerciseDropdown();
  renderHistory();
}

export function populateHistoryExerciseDropdown() {
  const select = document.getElementById('historyExerciseSelect');
  const dayFilterVal = document.getElementById('historyDayFilter')?.value || '';
  if (!select) return;

  const history = getHistory();
  const exerciseSet = new Set();

  history.forEach(h => {
    if (dayFilterVal && String(h.day) !== dayFilterVal) return;
    if (h.exercises) {
      h.exercises.forEach(ex => {
        if (ex.name) {
          if (!dayFilterVal || String(h.day) === String(dayFilterVal)) {
            exerciseSet.add(ex.name);
          }
        }
      });
    }
  });

  let html = `<option value="">View progression graph…</option>`;
  exerciseSet.forEach(name => {
    html += `<option value="${esc(name)}">${esc(name)}</option>`;
  });
  select.innerHTML = html;
}

export function populateCompoundSelect() {
  const select = document.getElementById('compoundSelect');
  if (!select) return;
  // Lifts with history, by category, most recently logged first (labelled with their latest name).
  const names = new Map();
  getHistory().forEach(h =>
    (h.exercises || []).forEach(ex => {
      if (ex.category && !names.has(ex.category)) names.set(ex.category, ex.name || ex.category);
    })
  );
  const current = select.value;
  select.innerHTML =
    [...names].map(([cat, name]) => `<option value="${esc(cat)}">${esc(name)}</option>`).join('') ||
    '<option value="">No lifts logged yet</option>';
  select.value = names.has(current) ? current : defaultTrendLift(names);
}

// The first compound lift of today's workout that has history, else the most recently logged lift.
function defaultTrendLift(names) {
  const day = WORKOUT[activeDay];
  const exercises = day ? day.sections.flatMap(sec => sec.exercises || []) : [];
  const compound = exercises.find(ex => ex.exerciseType === 'compound' && names.has(ex.category));
  return compound ? compound.category : names.keys().next().value || '';
}

export function renderHistoryForSelectedExercise(exerciseName) {
  if (!exerciseName) return;
  const history = getHistory();
  const dayFilterVal = document.getElementById('historyDayFilter')?.value || '';
  const dataPoints = [];

  history
    .slice()
    .reverse()
    .forEach(h => {
      if (dayFilterVal && String(h.day) !== dayFilterVal) return;
      if (h.exercises) {
        h.exercises.forEach(ex => {
          if (ex.name === exerciseName) {
            let maxW = 0;
            ex.sets.forEach(s => {
              if (s.done !== false) {
                const w = parseFloat(s.weight) || 0;
                if (w > maxW) maxW = w;
              }
            });
            if (maxW > 0) {
              dataPoints.push({ date: h.date, weight: maxW });
            }
          }
        });
      }
    });

  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.id = 'exerciseChartModalOverlay';
  modal.dataset.onSelfClick = 'closeClosestModal';
  modal.dataset.args = JSON.stringify(['$el']);

  let chartSvg = '';
  if (!dataPoints.length) {
    chartSvg = `<p style="color:var(--muted); text-align:center; padding:24px;">No lifting data recorded for ${esc(exerciseName)} in selected filter.</p>`;
  } else {
    const maxW = Math.max(...dataPoints.map(d => d.weight), 10);
    const w = 520,
      h = 260,
      pad = 40,
      chartW = w - pad * 2,
      chartH = h - pad * 2;
    chartSvg = `<svg class="plate-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
    for (let i = 0; i <= 4; i++) {
      const y = pad + chartH - (i * chartH) / 4;
      chartSvg += `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" class="chart-grid" />`;
      chartSvg += `<text x="${pad - 8}" y="${y + 4}" text-anchor="end" class="chart-label">${(maxW - (i * maxW) / 4).toFixed(0)}</text>`;
    }

    let pointsStr = '';
    dataPoints.forEach((d, i) => {
      const x = pad + (dataPoints.length === 1 ? chartW / 2 : (i / (dataPoints.length - 1)) * chartW);
      const y = pad + chartH - (d.weight / maxW) * chartH;
      pointsStr += `${x},${y} `;
      chartSvg += `<circle cx="${x}" cy="${y}" r="6" fill="var(--accent)" stroke="var(--bg)" stroke-width="2" />`;
      chartSvg += `<text x="${x}" y="${y - 12}" text-anchor="middle" class="chart-value">${d.weight}kg</text>`;
      chartSvg += `<text x="${x}" y="${h - 10}" text-anchor="middle" class="chart-label">${d.date.slice(5)}</text>`;
    });

    if (dataPoints.length > 1) {
      chartSvg += `<polyline fill="none" stroke="var(--accent)" stroke-width="3" points="${pointsStr.trim()}" />`;
    }
    chartSvg += `</svg>`;
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 620px;">
      <div class="modal-header">
        <h2>${icon('trend', 20)} Progression: ${esc(exerciseName)}</h2>
        <button class="btn-xs" aria-label="Close" data-on-click="closeClosestModal" data-args="${args('$el')}">${icon('x', 16)}</button>
      </div>
      <div class="modal-body">
        <div class="svg-chart-wrap">${chartSvg}</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-on-click="closeClosestModal" data-args="${args('$el')}">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('historyExerciseSelect').value = '';
}

// ==========================================
// INTERACTIVE ACCORDION LOG HISTORY
// ==========================================
export function toggleLogAccordion(headerElem) {
  const item = headerElem.closest('.log-item');
  item.classList.toggle('expanded');
}

export function renderHistory() {
  const container = document.getElementById('historyListContainer');
  const history = getHistory();
  container.innerHTML = '';

  const dayFilter = document.getElementById('historyDayFilter')?.value || '';

  const filteredHistory = history.filter(h => {
    if (dayFilter && String(h.day) !== dayFilter) return false;
    return true;
  });

  if (!filteredHistory.length) {
    container.innerHTML = history.length
      ? `<p style="color:var(--muted); text-align:center; padding:24px;">No sessions for this day yet.</p>`
      : `<div class="chart-empty"><p>No workouts yet. Finish today's session and it will show up here.</p><button class="btn btn-secondary" data-on-click="closeHistoryAndShowWorkout">Go to today's workout</button></div>`;
    return;
  }

  const maxMap = calculateMaxWeightsPerExercise();

  filteredHistory.forEach(h => {
    const div = document.createElement('div');
    div.className = 'log-item';
    div.dataset.sessionKey = sessionKey(h);

    let exercisesHtml = '';
    if (h.exercises && h.exercises.length) {
      exercisesHtml = h.exercises
        .map(ex => {
          const workingSets = ex.sets.filter(s => s.done !== false);
          const setsStr = workingSets
            .map(s => `${esc(s.weight)}kg×${esc(s.reps)} (${esc(s.tag || 'Working')})`)
            .join(' • ');

          let hitPr = false;
          workingSets.forEach(s => {
            const w = parseFloat(s.weight) || 0;
            const key = ex.category || ex.name;
            if (w > 0 && key && maxMap[key] === w) {
              hitPr = true;
            }
          });

          const prBadge = hitPr ? `<span class="log-pr-badge">${icon('trophy', 12)} PR</span>` : '';

          return `
          <div class="log-exercise-row">
            <div class="log-exercise-header-line">
              <div class="log-exercise-title">${esc(ex.name)} (${esc(ex.machineOpt || 'Standard')})</div>
              ${prBadge}
            </div>
            <div class="log-sets-summary">${setsStr || 'No sets recorded'}</div>
          </div>
        `;
        })
        .join('');
    }

    const notesBlock = h.notes ? `<div class="log-session-notes">"${esc(h.notes)}"</div>` : '';

    div.innerHTML = `
      <div class="log-item-header" data-on-click="toggleLogAccordion" data-args="${args('$el')}">
        <span class="log-item-title">${icon('calendar', 14)} ${esc(h.date)} • Day ${esc(h.day)}: ${esc(String(h.dayTitle).replace(/^\s*⚡\s*/u, ''))}</span>
        <span class="log-item-meta">${icon('timer', 14)} ${esc(h.duration)} ${icon('chevron-down', 14)}</span>
      </div>
      <div class="log-item-body">
        <div class="log-body-top">
          <div style="font-size: 11.5px; color: var(--muted);">Body weight: ${esc(h.bodyWeight)}kg | Energy: ${esc(h.energy)}/10 | Sleep: ${esc(h.sleep)}hrs</div>
          <button class="btn-xs btn-xs-danger" data-on-click="deleteWorkoutSession" data-args="${args('$el')}">${icon('trash', { size: 14 })} Delete</button>
        </div>
        ${notesBlock}
        ${exercisesHtml}
      </div>
    `;
    container.appendChild(div);
  });
}

export function openHistoryModal() {
  populateHistoryExerciseDropdown();
  renderHistory();
  document.getElementById('historyModalOverlay').classList.add('active');
}
export function closeHistoryModal() {
  document.getElementById('historyModalOverlay').classList.remove('active');
}
export function closeHistoryAndShowWorkout() {
  closeHistoryModal();
  showTab('workout');
}

// Deletes one logged session. Its id is tombstoned so sync removes it on other devices too.
export async function deleteWorkoutSession(btn) {
  const key = btn.closest('.log-item')?.dataset.sessionKey;
  const history = getHistory();
  const session = history.find(rec => sessionKey(rec) === key);
  if (!session) return;
  const title = String(session.dayTitle || `Day ${session.day}`).replace(/^\s*⚡\s*/u, '');
  if (
    !(await confirmDialog(`Delete the ${session.date || 'undated'} session (${title})? This can't be undone.`, {
      confirmLabel: 'Delete',
      danger: true
    }))
  )
    return;
  setJ(HISTORY_TOMBSTONES_KEY, [...new Set([...getJ(HISTORY_TOMBSTONES_KEY, []), key])]);
  setHistory(history.filter(rec => sessionKey(rec) !== key));
  pushToCloud();
  refreshAllUI(); // history list, charts, header streak and last-time hints
  showToast('Session deleted.', 'success');
}

export async function clearWorkoutHistory() {
  if (
    await confirmDialog("Clear all workout history? This can't be undone.", {
      confirmLabel: 'Clear history',
      danger: true
    })
  ) {
    // Tombstone the sessions so the history merge does not bring them back from the cloud.
    const cleared = getHistory().map(sessionKey);
    setJ(HISTORY_TOMBSTONES_KEY, [...new Set([...getJ(HISTORY_TOMBSTONES_KEY, []), ...cleared])]);
    clearHistory();
    if (currentUser && supabaseClient) pushToCloud();
    renderHistory();
    refreshAllUI();
  }
}

export function exportHistoryJSON() {
  const data = JSON.stringify(getHistory());
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'irontrack_history.json';
  a.click();
}

export function exportHistoryCSV() {
  const history = getHistory();
  if (!history.length) {
    showToast('No history available to export.', 'error');
    return;
  }

  const rows = [
    [
      'Date',
      'Day',
      'Split Title',
      'Duration',
      'BodyWeight(kg)',
      'Exercise',
      'Equipment',
      'Set',
      'Weight(kg)',
      'Reps',
      'Tag',
      'RIR'
    ]
  ];

  history.forEach(session => {
    (session.exercises || []).forEach(ex => {
      (ex.sets || []).forEach(s => {
        rows.push([
          session.date || '',
          session.day || '',
          `"${(session.dayTitle || '').replace(/"/g, '""')}"`,
          session.duration || '',
          session.bodyWeight || '',
          `"${(ex.name || '').replace(/"/g, '""')}"`,
          `"${(ex.machineOpt || '').replace(/"/g, '""')}"`,
          s.setNum ?? '',
          s.weight ?? '', // ?? so a 0 (e.g. a bodyweight set) isn't exported as blank
          s.reps ?? '',
          s.tag || 'Working',
          s.rir ?? ''
        ]);
      });
    });
  });

  // A Blob, not a data: URL: encodeURI leaves '#' alone, so a '#' in any field cut the file off there.
  const blob = new Blob([rows.map(e => e.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `irontrack_history_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast('📥 CSV exported successfully!', 'success');
}

export function exportFullBackup() {
  const backup = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('iron_')) {
      backup[key] = localStorage.getItem(key);
    }
  }
  // Stored as strings, like the other keys.
  backup[HISTORY_KEY] = JSON.stringify(getHistory());
  backup[NUTRITION_LOG_KEY] = JSON.stringify(getNutritionLog());
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `irontrack_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  showToast('📦 Full backup exported!', 'success');
}

export function importBackupFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data)) {
        setHistory(data);
      } else if (typeof data === 'object') {
        Object.keys(data).forEach(key => {
          if (key === HISTORY_KEY || key === NUTRITION_LOG_KEY) {
            const list = typeof data[key] === 'string' ? JSON.parse(data[key]) : data[key];
            if (Array.isArray(list)) (key === HISTORY_KEY ? setHistory : setNutritionLog)(list);
          } else if (key.startsWith('iron_')) {
            localStorage.setItem(key, typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]));
          }
        });
      }
      pushToCloud();
      refreshAllUI();
      showToast('✅ Backup imported successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('❌ Invalid JSON backup file.', 'error');
    }
    input.value = '';
  };
  reader.readAsText(file);
}
