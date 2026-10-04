import { args } from '../actions.js';
import { icon } from '../icons.js';
import { esc } from '../storage.js';
import { checkStartWorkoutTimer } from './timers.js';
import { updateLastHints } from './exercise-hints.js';
import { updateProgress, updateSectionWorkingSetCounts } from './workout.js';

// The set rows in each exercise card's table: rendering, adding and removing rows, and the steppers.

export function formatPreset(sets) {
  if (!sets || !sets.length) return '';
  return sets
    .map(s => {
      const w = s.weight === 0 ? 'BW' : s.weight === '' || s.weight == null ? '' : s.weight;
      const r = s.reps == null ? '' : s.reps;
      let txt = w + '×' + r;
      if (s.tag && s.tag !== 'Working') txt = `[${s.tag}] ` + txt;
      return txt;
    })
    .join(', ');
}

const SET_TAGS = ['Warmup', 'Working', 'Drop Set', 'Failure'];

// Cells of one set row: number (tap for tag/RIR) · weight · reps · done, plus the tag/RIR panel
// that wraps onto its own line when the row is expanded. `s` is a preset/default set or {}.
function setRowCells(prefix, n, s, rest) {
  const tag = s.tag || 'Working';
  const rir = s.rir == null ? 1 : s.rir;
  const wVal = s.weight === 0 ? '0' : s.weight === '' || s.weight == null ? '' : s.weight;
  const rVal = s.reps == null ? '' : s.reps;
  const tagOptions = SET_TAGS.map(t => `<option value="${t}" ${t === tag ? 'selected' : ''}>${t}</option>`).join('');
  return `<td class="set-num-cell"><button type="button" class="set-num-btn" data-on-click="toggleSetDetails" data-args="${args('$el')}" aria-label="Set ${n}: tag and RIR" aria-expanded="false">${n}</button></td>
    <td><div class="stepper"><button type="button" class="stepper-btn" data-on-click="stepValue" data-args="${args(`${prefix}_w_${n}`, -2.5)}" aria-label="Less weight">−</button><input type="number" inputmode="decimal" class="input-field set-weight" id="${prefix}_w_${n}" value="${esc(wVal)}" placeholder="kg" data-on-focusin="selectText" data-on-input="checkStartWorkoutTimer" data-args="${args('$el')}"><button type="button" class="stepper-btn" data-on-click="stepValue" data-args="${args(`${prefix}_w_${n}`, 2.5)}" aria-label="More weight">+</button></div></td>
    <td><div class="stepper"><button type="button" class="stepper-btn" data-on-click="stepValue" data-args="${args(`${prefix}_r_${n}`, -1)}" aria-label="Fewer reps">−</button><input type="number" inputmode="numeric" class="input-field set-reps" id="${prefix}_r_${n}" value="${esc(rVal)}" placeholder="reps" data-on-focusin="selectText" data-on-input="checkStartWorkoutTimer" data-args="${args('$el')}"><button type="button" class="stepper-btn" data-on-click="stepValue" data-args="${args(`${prefix}_r_${n}`, 1)}" aria-label="More reps">+</button></div></td>
    <td class="set-done-cell"><button type="button" class="check-btn" data-on-click="toggleSet" data-args="${args('$el', rest)}" aria-label="Set ${n} done">${icon('check', { size: 22 })}</button></td>
    <td class="set-last"><span class="set-last-text"></span><span class="set-badge"></span></td>
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

export function stepValue(id, delta) {
  const input = document.getElementById(id);
  if (!input) return;
  const val = parseFloat(input.value) || 0;
  input.value = Math.max(0, val + delta);
  checkStartWorkoutTimer();
}

export function addSetRow(tableId, prefix, rest, update = true) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = setRowCells(prefix, tbody.children.length + 1, {}, rest);
  tbody.appendChild(tr);
  const card = table.closest('.exercise-card');
  if (card) updateLastHints(card);
  if (update) {
    updateSectionWorkingSetCounts();
    updateProgress();
  }
}

export function removeSetRow(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (tbody.children.length > 1) tbody.removeChild(tbody.lastElementChild);
  updateSectionWorkingSetCounts();
  updateProgress();
}
