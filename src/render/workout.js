import { FLAT_EXERCISES, WORKOUT, getChoice, getLinkedCategory, getNextCategory, getPreset, getPreviousCategory, getRestForCategory, setChoice } from '../model.js';
import { populateDayDropdown } from './exercises.js';
import { populateCompoundSelect, populateHistoryDayFilter, populateHistoryExerciseDropdown } from './history.js';
import { renderDayNav } from './schedule.js';
import { generateShareCard } from './share-card.js';
import { clearSessionDraft, hasSessionDraft, saveSessionDraft } from '../session-draft.js';
import { esc, getJ, getL, isSafeId, setJ, setL } from '../storage.js';
import { pushToCloud } from '../sync.js';
import { fireConfetti, playBeep, showToast } from '../ui.js';

export let activeDay = '1';
let restInterval = null;
let confettiFired = false;
let lastFinishedRecord = null;
export let hasStartedWorkout = false;
export let workoutStartTime = null;
let workoutTimerInterval = null;
export function getRestMultiplier() {
  const m = parseFloat(getL('iron_setting_rest_multiplier', '1'));
  return isNaN(m) ? 1 : Math.max(0.5, Math.min(2.0, m));
}
export function updateRestMultiplierLabel() {
  const val = document.getElementById('restMultiplier')?.value || '1';
  const label = document.getElementById('restMultiplierValue');
  if (label) label.textContent = parseFloat(val).toFixed(2) + 'x';
}

export function captureCurrentFormValues() {
  const data = {};
  document.querySelectorAll('#dayViews .exercise-card').forEach(card => {
    const prefix = card.dataset.prefix;
    const table = document.getElementById('table_' + prefix);
    if (table) {
      data[prefix] = [];
      table.querySelectorAll('tbody tr').forEach(tr => {
        data[prefix].push({
          weight: tr.querySelector('.set-weight')?.value || '',
          reps: tr.querySelector('.set-reps')?.value || '',
          tag: tr.querySelector('.set-tag')?.value || 'Working',
          rir: tr.querySelector('.set-rir')?.value || '1',
          done: tr.querySelector('.check-btn')?.classList.contains('completed') || false
        });
      });
    }
  });
  return data;
}

export function restoreFormValues(data) {
  for (const prefix in data) {
    if (!isSafeId(prefix) || !Array.isArray(data[prefix])) continue;
    const table = document.getElementById('table_' + prefix);
    if (!table) continue;
    // Match the row count first: the user may have added or removed sets.
    const tbody = table.querySelector('tbody');
    const rest = Number(table.closest('.exercise-card')?.dataset.rest) || 75;
    while (data[prefix].length && tbody.children.length < data[prefix].length) addSetRow('table_' + prefix, prefix, rest, false);
    while (data[prefix].length && tbody.children.length > data[prefix].length) tbody.removeChild(tbody.lastElementChild);
    const rows = table.querySelectorAll('tbody tr');
    data[prefix].forEach((s, i) => {
      if (rows[i]) {
        const wIn = rows[i].querySelector('.set-weight');
        const rIn = rows[i].querySelector('.set-reps');
        const tIn = rows[i].querySelector('.set-tag');
        const riIn = rows[i].querySelector('.set-rir');
        const btn = rows[i].querySelector('.check-btn');

        if (wIn) wIn.value = s.weight;
        if (rIn) rIn.value = s.reps;
        if (tIn) tIn.value = s.tag;
        if (riIn) riIn.value = s.rir;
        if (btn) btn.classList.toggle('completed', !!s.done);
      }
    });
  }
  updateSectionWorkingSetCounts();
  updateProgress();
  updateSessionStats();
}

export function formatPreset(sets) {
  if (!sets || !sets.length) return '';
  return sets.map(s => {
    const w = s.weight === 0 ? 'BW' : (s.weight === '' || s.weight == null ? '' : s.weight);
    const r = s.reps == null ? '' : s.reps;
    let txt = w + '×' + r;
    if (s.tag && s.tag !== 'Working') txt = `[${s.tag}] ` + txt;
    return txt;
  }).join(', ');
}

const SET_TAGS = ['Warmup', 'Working', 'Drop Set', 'Failure'];

// Cells of one set row: number (tap for tag/RIR) · weight · reps · done, plus the tag/RIR panel
// that wraps onto its own line when the row is expanded. `s` is a preset/default set or {}.
function setRowCells(prefix, n, s, rest) {
  const tag = s.tag || 'Working';
  const rir = s.rir == null ? 1 : s.rir;
  const wVal = s.weight === 0 ? '0' : (s.weight === '' || s.weight == null ? '' : s.weight);
  const rVal = s.reps == null ? '' : s.reps;
  const tagOptions = SET_TAGS.map(t => `<option value="${t}" ${t === tag ? 'selected' : ''}>${t}</option>`).join('');
  return `<td class="set-num-cell"><button type="button" class="set-num-btn" onclick="toggleSetDetails(this)" aria-label="Set ${n}: tag and RIR" aria-expanded="false">${n}</button></td>
    <td><div class="stepper"><button type="button" class="stepper-btn" onclick="stepValue('${prefix}_w_${n}', -2.5)" aria-label="Less weight">−</button><input type="number" inputmode="decimal" class="input-field set-weight" id="${prefix}_w_${n}" value="${esc(wVal)}" placeholder="kg" oninput="checkStartWorkoutTimer()"><button type="button" class="stepper-btn" onclick="stepValue('${prefix}_w_${n}', 2.5)" aria-label="More weight">+</button></div></td>
    <td><div class="stepper"><button type="button" class="stepper-btn" onclick="stepValue('${prefix}_r_${n}', -1)" aria-label="Fewer reps">−</button><input type="number" inputmode="numeric" class="input-field set-reps" id="${prefix}_r_${n}" value="${esc(rVal)}" placeholder="reps" oninput="checkStartWorkoutTimer()"><button type="button" class="stepper-btn" onclick="stepValue('${prefix}_r_${n}', 1)" aria-label="More reps">+</button></div></td>
    <td class="set-done-cell"><button type="button" class="check-btn" onclick="toggleSet(this, ${rest})" aria-label="Set ${n} done">✓</button></td>
    <td class="set-extra">
      <label>Tag <select class="set-tag" id="${prefix}_t_${n}">${tagOptions}</select></label>
      <label>RIR <input type="number" inputmode="numeric" class="input-field set-rir" id="${prefix}_ri_${n}" value="${esc(rir)}"></label>
    </td>`;
}

export function renderSetRows(prefix, sets, rest) {
  return sets.map((s, i) => `<tr>${setRowCells(prefix, i + 1, s || {}, rest)}</tr>`).join('');
}

export function toggleSetDetails(btn) {
  const tr = btn.closest('tr');
  const open = tr.classList.toggle('expanded');
  btn.setAttribute('aria-expanded', String(open));
}
export function getSupersetDecorations(category) {
  const linked = getLinkedCategory(category);
  const prev = getPreviousCategory(category);
  const isSecond = linked && prev === linked;
  const cls = linked ? 'superset' : '';
  const badge = isSecond ? `<span class="superset-badge">⛓ Superset</span>` : '';
  return { linked, isSecond, cls, badge };
}
export function getSupersetBtn(category) {
  const linked = getLinkedCategory(category);
  if (linked) return `<button class="btn-xs btn-superset active edit-only" onclick="toggleSuperset('${category}')">⛓ Unlink Superset</button>`;
  const next = getNextCategory(category);
  if (!next) return '';
  return `<button class="btn-xs btn-superset edit-only" onclick="toggleSuperset('${category}')">⛓ Superset with next</button>`;
}

export function renderExerciseCard(ex, idx) {
  const firstVar = ex.variations[0];
  const options = ex.variations.map(v => `<option value="${esc(v.value)}">${esc(v.label)}</option>`).join('');
  
  const savedChoice = getChoice(ex.category);
  const activeVarVal = (savedChoice && ex.variations.some(v => v.value === savedChoice)) ? savedChoice : firstVar.value;
  const activeVarObj = ex.variations.find(v => v.value === activeVarVal) || firstVar;
  
  const storedPreset = getPreset(ex.category, activeVarObj.value);
  const sets = (storedPreset && storedPreset.length) ? storedPreset : activeVarObj.defaultSets;
  const dec = getSupersetDecorations(ex.category);
  const supBtn = getSupersetBtn(ex.category);

  return `
  <div class="exercise-card ${idx===1 ? 'highlight' : ''} ${dec.cls}" data-category="${ex.category}" data-prefix="${ex.prefix}" data-exercise-type="${esc(ex.exerciseType)}" data-rest="${ex.rest}">
    <div class="ex-header">
      <div>
        <div class="ex-title-row"><span class="ex-number">${String(idx).padStart(2,'0')}</span><div class="ex-title">${esc(ex.title)}</div>${dec.badge}</div>
        <div class="ex-target">${esc(ex.target)}</div>
      </div>
      <div class="ex-meta">
        <span class="ex-type-badge">${esc(ex.exerciseType)}</span>
        <span class="ex-scheme-badge">${esc(ex.scheme)}</span>
      </div>
    </div>
    <div class="machine-selector-wrapper">
      <div class="machine-label">🏋️ Equipment:</div>
      <select class="machine-dropdown" id="${ex.category}Select" onchange="onVariationChange('${ex.category}', '${ex.prefix}', this)">
        ${options}
      </select>
      <div class="equip-tools edit-only">
        <button class="btn-xs" title="Move Up" onclick="reorderEquipment('${ex.category}', -1)">⬆</button>
        <button class="btn-xs" title="Move Down" onclick="reorderEquipment('${ex.category}', 1)">⬇️</button>
        <button class="btn-xs" style="color:var(--accent); border-color:var(--accent-glow);" onclick="openAddVarModal('${ex.category}')">➕ Add Var</button>
        <button class="btn-xs" style="color:var(--lime); border-color:rgba(57,255,20,0.35);" onclick="openPresetModal('${ex.category}')">⚙ Preset</button>
        <button class="btn-xs" style="color:#fca5a5; border-color:rgba(239,68,68,0.35);" onclick="removeEquipment('${ex.category}')">🗑</button>
      </div>
    </div>
    <div class="ex-meta-info">
      <div class="info-row">
        <span class="info-pill setup" id="${ex.prefix}SetupBadge">${esc(activeVarObj.setup)}</span>
        <span class="info-pill prev" id="${ex.prefix}PrevBadge">⏮️️ Preset: ${esc(formatPreset(sets))}</span>
      </div>
      <div class="info-row">
        <span class="info-pill cue" id="${ex.prefix}CueBadge">${esc(activeVarObj.cue)}</span>
        <span class="info-pill overload" id="${ex.prefix}OverloadBadge" style="display:none;"></span>
      </div>
    </div>
    <div class="sets-table-wrap">
      <table class="sets-table" id="table_${ex.prefix}">
        <thead><tr><th>Set</th><th>Weight (kg)</th><th>Reps</th><th aria-label="Done"></th></tr></thead>
        <tbody>${renderSetRows(ex.prefix, sets, ex.rest)}</tbody>
      </table>
    </div>
    <div class="ex-actions-bar">
      <button class="btn-xs" onclick="addSetRow('table_${ex.prefix}', '${ex.prefix}', ${ex.rest})">➕ Add Set</button>
      <button class="btn-xs" onclick="removeSetRow('table_${ex.prefix}')">➖ Remove Set</button>
      <button class="btn-xs edit-only" onclick="reorderExercise('${ex.category}', -1)">⬆ Up</button>
      <button class="btn-xs edit-only" onclick="reorderExercise('${ex.category}', 1)">⬇️ Down</button>
      ${supBtn}
      <button class="btn-xs edit-only" style="color:#fca5a5; border-color:rgba(239,68,68,0.35);" onclick="removeExercise('${ex.category}')">🗑 Remove Exercise</button>
    </div>
  </div>`;
}

export function renderDay(dayNum) {
  const day = WORKOUT[dayNum];
  if (!day) return '';
  let html = `<div class="day-view" id="view-day-${dayNum}">`;
  day.sections.forEach((sec, sidx) => {
    const displayTitle = (sec.title && sec.title !== 'undefined') ? sec.title : 'General';
    html += `<div class="category-section">
      <div class="category-header-row">
        <div class="category-tag tag-${sec.color || 'blue'}" id="${sec.tag}">${sidx+1}. ${esc(displayTitle)} (<span class="set-count">0</span> Working Sets)</div>
        <div class="section-actions edit-only">
          <button class="btn-xs" title="Move Section Up" onclick="reorderSection('${dayNum}', ${sidx}, -1)">⬆ Up</button>
          <button class="btn-xs" title="Move Section Down" onclick="reorderSection('${dayNum}', ${sidx}, 1)">⬇ Down</button>
          <button class="btn-xs" style="color:var(--coral); border-color:rgba(255,77,77,0.35);" title="Remove Section" onclick="removeSection('${dayNum}', ${sidx})">🗑️</button>
        </div>
      </div>`;
      if (!sec.exercises || sec.exercises.length === 0) {
        html += `<div style="padding:16px; text-align:center; color:var(--muted); font-size:12.5px; background:rgba(15,23,42,0.4); border-radius:var(--radius-sm); border:1px dashed var(--card-border);">No exercises yet in this section. Tap ✏️ Edit, then Add Exercise.</div>`;
      } else {
        sec.exercises.forEach((ex, eidx) => { html += renderExerciseCard(ex, eidx+1); });
      }
    html += `</div>`;
  });
  html += `</div>`;
  return html;
}

export function renderAll() {
  const container = document.getElementById('dayViews');
  const days = Object.keys(WORKOUT);
  // A sync or an edit can re-render mid-workout: keep what the user has entered so far.
  const formData = hasSessionDraft() ? captureCurrentFormValues() : null;
  const focusedId = container.contains(document.activeElement) ? document.activeElement.id : '';
  container.innerHTML = days.map(d => renderDay(d)).join('');
  if (formData) restoreFormValues(formData);
  if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
  renderDayNav();
  
  // Only repopulate if the modal is closed to preserve user input
  const isAddOpen = document.getElementById('addExModalOverlay')?.classList.contains('active');
  if (!isAddOpen) {
    populateDayDropdown();
  }

  populateHistoryDayFilter();
  populateHistoryExerciseDropdown();
  populateCompoundSelect();
}

export function applyVariation(category, prefix, variation, fillRows=true) {
  const ex = FLAT_EXERCISES.find(e => e.category === category);
  if (!ex) return;
  const varObj = ex.variations.find(v => v.value === variation);
  if (!varObj) return;

  const setup = document.getElementById(prefix + 'SetupBadge');
  const cue = document.getElementById(prefix + 'CueBadge');
  const prev = document.getElementById(prefix + 'PrevBadge');

  if (setup) { setup.style.display = varObj.setup ? 'inline-flex' : 'none'; setup.textContent = varObj.setup; }
  if (cue) { cue.style.display = varObj.cue ? 'inline-flex' : 'none'; cue.textContent = varObj.cue; }

  const storedPreset = getPreset(category, variation);
  const defaultSets = varObj.defaultSets;
  let sourceSets = (storedPreset && storedPreset.length) ? storedPreset : defaultSets;
  let sourceLabel = storedPreset && storedPreset.length ? 'Preset' : 'Default';

  const table = document.getElementById('table_' + prefix);
  if (table && fillRows) {
    const tbody = table.querySelector('tbody');
    while (tbody.children.length < sourceSets.length) {
      addSetRow('table_' + prefix, prefix, ex.rest, false);
    }
    while (tbody.children.length > sourceSets.length) {
      tbody.removeChild(tbody.lastElementChild);
    }
    for (let i = 0; i < sourceSets.length; i++) {
      const row = tbody.children[i];
      if (!row) continue;
      const s = sourceSets[i] || {};
      const wRaw = s.weight === 0 ? '0' : (s.weight === '' || s.weight == null ? '' : s.weight);
      const rRaw = s.reps == null ? '' : s.reps;
      
      const wInput = row.querySelector('.set-weight');
      const rInput = row.querySelector('.set-reps');
      const tInput = row.querySelector('.set-tag');
      const riInput = row.querySelector('.set-rir');

      if (wInput) wInput.value = wRaw;
      if (rInput) rInput.value = rRaw;
      if (tInput) tInput.value = s.tag || 'Working';
      if (riInput && s.rir != null) riInput.value = s.rir;
      
      const checkBtn = row.querySelector('.check-btn');
      if (checkBtn) checkBtn.classList.remove('completed');
    }
  }

  if (prev) {
    const str = formatPreset(sourceSets);
    prev.style.display = str ? 'inline-flex' : 'none';
    prev.textContent = '⏮️ ' + sourceLabel + ': ' + str;
  }
}

export function onVariationChange(category, prefix, select) {
  const val = select.value;
  setChoice(category, val);
  applyVariation(category, prefix, val);
  updateSectionWorkingSetCounts();
  updateProgress();
}

export function stepValue(id, delta) {
  const input = document.getElementById(id);
  if (!input) return;
  const val = parseFloat(input.value) || 0;
  input.value = Math.max(0, val + delta);
  checkStartWorkoutTimer();
}

export function addSetRow(tableId, prefix, rest, update=true) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = setRowCells(prefix, tbody.children.length + 1, {}, rest);
  tbody.appendChild(tr);
  if (update) { updateSectionWorkingSetCounts(); updateProgress(); }
}

export function removeSetRow(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (tbody.children.length > 1) tbody.removeChild(tbody.lastElementChild);
  updateSectionWorkingSetCounts(); updateProgress();
}

export function switchDayView(day, resetSession = false) {
  activeDay = String(day);
  setL('iron_active_day', activeDay);
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.classList.contains(`day-${activeDay}`)));
  document.querySelectorAll('.day-view').forEach((view) => view.classList.toggle('active', view.id === `view-day-${activeDay}`));
  const cfg = WORKOUT[activeDay];
  if (!cfg) return;
  const badge = document.getElementById('currentDayBadge');
  badge.textContent = cfg.badge || `Day ${activeDay} Focus`;
  document.getElementById('currentDayTitle').textContent = cfg.title;
  document.getElementById('currentDaySub').textContent = cfg.sub;
  updateSectionWorkingSetCounts();
  updateProgress();
  confettiFired = false;
  
  if (resetSession) {
    hasStartedWorkout = false;
    workoutStartTime = null;
    clearInterval(workoutTimerInterval);
    document.getElementById('timeElapsed').textContent = "00:00:00";
    if (document.getElementById('sessionNotes')) document.getElementById('sessionNotes').value = '';
    if (hasSessionDraft()) saveSessionDraft();
  }
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

export function updateSectionWorkingSetCounts() {
  Object.values(WORKOUT).forEach(day => day.sections.forEach(sec => {
    let count = 0;
    if (sec.exercises) {
      sec.exercises.forEach(ex => {
        const table = document.getElementById('table_' + ex.prefix);
        if (table) count += table.querySelectorAll('tbody tr').length;
      });
    }
    const tag = document.getElementById(sec.tag);
    if (tag) {
      const counter = tag.querySelector('.set-count');
      if (counter) counter.textContent = count;
    }
  }));
}

export function getDaySetCounts(day) {
  const view = document.getElementById('view-day-' + day);
  if (!view) return { total: 0, completed: 0 };
  const total = view.querySelectorAll('tbody tr').length;
  const completed = view.querySelectorAll('.check-btn.completed').length;
  return { total, completed };
}

export function updateSessionStats() {
  const view = document.getElementById('view-day-' + activeDay);
  const setsEl = document.getElementById('statsSets');
  const tonEl = document.getElementById('statsTonnage');
  if (!view) { if (setsEl) setsEl.textContent = '0'; if (tonEl) tonEl.textContent = '0 kg'; return; }
  let completed = 0, tonnage = 0;
  view.querySelectorAll('.check-btn.completed').forEach(btn => {
    const tr = btn.closest('tr');
    if (!tr) return;
    const w = parseFloat(tr.querySelector('.set-weight')?.value);
    const r = parseFloat(tr.querySelector('.set-reps')?.value);
    completed++;
    if (!isNaN(w) && !isNaN(r)) tonnage += w * r;
  });
  if (setsEl) setsEl.textContent = completed;
  if (tonEl) tonEl.textContent = tonnage.toFixed(0) + ' kg';
}

export function updateProgress() {
  const { total, completed } = getDaySetCounts(activeDay);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  document.getElementById('progressText').textContent = `${completed} / ${total} sets`;
  document.getElementById('progressBar').style.width = Math.min(pct, 100) + '%';
  updateSessionStats();
  if (completed === total && total > 0 && !confettiFired) {
    fireConfetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    confettiFired = true;
  }
  if (completed < total) confettiFired = false;
}

export function toggleSet(btn, restSeconds) {
  checkStartWorkoutTimer();
  btn.classList.toggle('completed');
  updateProgress();
  if (btn.classList.contains('completed')) {
    const card = btn.closest('.exercise-card');
    const category = card ? card.dataset.category : '';
    let effectiveRest = restSeconds;
    const linked = category ? getLinkedCategory(category) : null;
    if (linked) effectiveRest = Math.max(effectiveRest, getRestForCategory(linked));
    startRestTimer(Math.round(effectiveRest * getRestMultiplier()));
  }
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

export function finishCurrentDayWorkout() {
  const view = document.getElementById('view-day-' + activeDay);
  if (!view) return;
  const exercises = [];
  view.querySelectorAll('.exercise-card').forEach(card => {
    const name = card.querySelector('.ex-title').textContent;
    const select = card.querySelector('.machine-dropdown');
    const variationValue = select ? select.value : '';
    const machineOpt = select ? select.selectedOptions[0].textContent : 'Default';
    const sets = [];
    card.querySelectorAll('tbody tr').forEach((tr, i) => {
      const wIn = tr.querySelector('.set-weight');
      const rIn = tr.querySelector('.set-reps');
      const riIn = tr.querySelector('.set-rir');
      const tIn = tr.querySelector('.set-tag');
      if (!rIn || rIn.value === '') return;
      sets.push({ setNum: i + 1, weight: wIn?.value || '0', reps: rIn?.value || '0', rir: riIn?.value || '0', tag: tIn?.value || 'Working', done: tr.querySelector('.check-btn').classList.contains('completed') });
    });
    exercises.push({ name, category: card.dataset.category, variationValue, exerciseType: card.dataset.exerciseType, machineOpt, sets });
  });
  const notesVal = document.getElementById('sessionNotes')?.value.trim() || '';
  const record = {
    id: 'session_' + Date.now(), day: activeDay, dayTitle: WORKOUT[activeDay] ? WORKOUT[activeDay].title : `Day ${activeDay}`,
    date: document.getElementById('sessionDate').value,
    bodyWeight: document.getElementById('bodyWeight').value || 'N/A',
    energy: document.getElementById('energyLevel').value || 'N/A',
    sleep: document.getElementById('sleepHours').value || 'N/A',
    notes: notesVal,
    duration: document.getElementById('timeElapsed').textContent,
    exercises
  };

  const history = getJ('iron_workout_history', []);
  history.unshift(record);
  if (!setJ('iron_workout_history', history)) {
    showToast('❌ Session NOT saved: device storage is full. Export a full backup from Settings to free space.', 'error');
    return;
  }
  pushToCloud();
  clearSessionDraft();
  lastFinishedRecord = record;
  showToast('💾 Workout saved & synced!', 'success');
  showCelebration();
  populateHistoryExerciseDropdown();
  populateCompoundSelect();
}

export function shareLastWorkout() { generateShareCard(lastFinishedRecord); }

export function resetCurrentDayForm() {
  if (!confirm(`Reset all sets and reload saved presets for Day ${activeDay}?`)) return;
  const dayView = document.getElementById('view-day-' + activeDay);
  if (dayView) {
    dayView.querySelectorAll('.exercise-card').forEach(card => {
      const category = card.dataset.category;
      const prefix = card.dataset.prefix;
      const select = document.getElementById(category + 'Select');
      if (select) {
        applyVariation(category, prefix, select.value, true);
      }
    });
  }
  clearSessionDraft();
  updateProgress();
  showToast('🔄 Day reset to saved presets!', 'info');
}

export function showCelebration() {
  const overlay = document.getElementById('celebrationOverlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="celebration-badge pr">
      <span>🎉 Workout Saved Successfully!</span>
      <p style="font-size:13px; color:var(--muted); font-weight:600;">Download your cyberpunk stats card to share your accomplishment.</p>
      <button class="btn btn-primary" onclick="shareLastWorkout()">📸 Download Share Card</button>
      <button class="btn btn-secondary" onclick="document.getElementById('celebrationOverlay').classList.remove('active')">Close</button>
    </div>
  `;
  overlay.classList.add('active');
  fireConfetti({ particleCount: 140, spread: 90, origin: { y: 0.55 } });
}
