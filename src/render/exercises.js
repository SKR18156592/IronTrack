import { confirmDialog } from '../dialog.js';
import { FLAT_EXERCISES, WORKOUT, getNextCategory, getPreset, getSupersetLinks, rebuildWorkoutDatabase, setChoice, setPreset, setSupersetLinks } from '../model.js';
import { activeDay, applyVariation, captureCurrentFormValues, renderAll, restoreFormValues, switchDayView } from './workout.js';
import { esc, getJ, setJ, setL } from '../storage.js';
import { pushToCloud } from '../sync.js';
import { showToast } from '../ui.js';

let activePresetModalData = null;
let activeAddVarCategory = null;

export function openAddExModal() {
  const form = document.getElementById('addExForm');
  if (form) form.reset();

  populateDayDropdown();

  // Explicitly select activeDay and populate its sections
  const targetDay = String(activeDay || '1');
  const exDaySelect = document.getElementById('exDay');
  if (exDaySelect) {
    exDaySelect.value = targetDay;
  }
  populateSectionDropdown(targetDay);

  const customField = document.getElementById('customSectionNameField');
  if (customField) customField.style.display = 'none';

  document.getElementById('addExModalOverlay').classList.add('active');
}
export function closeAddExModal() { document.getElementById('addExModalOverlay').classList.remove('active'); document.getElementById('addExForm').reset(); }

export function populateDayDropdown() {
  const sel = document.getElementById('exDay');
  if (!sel) return;
  sel.innerHTML = Object.keys(WORKOUT).map(d => `<option value="${d}">Day ${d}: ${esc(WORKOUT[d].title.replace('⚡ ', ''))}</option>`).join('');
}

export function populateSectionDropdown(dayNum) {
  const select = document.getElementById('exSectionSelect');
  if (!select || !WORKOUT[dayNum]) return;
  
  const sections = WORKOUT[dayNum].sections || [];
  let html = sections.map(s => `<option value="${esc(s.title)}">${esc(s.title)}</option>`).join('');
  html += `<option value="__NEW__">+ Create new section…</option>`;
  select.innerHTML = html;
  
  // Preserve or set the initial section value without firing unexpected form resets
  handleSectionSelectChange(select.value);
}

export function handleSectionSelectChange(val) {
  const customField = document.getElementById('customSectionNameField');
  const customInput = document.getElementById('exCustomSection');
  if (val === '__NEW__') {
    customField.style.display = 'flex';
    customInput.value = '';
    customInput.required = true;
  } else {
    customField.style.display = 'none';
    customInput.value = '';
    customInput.required = false;
  }
}

export function handleSaveCustomExercise(e) {
  e.preventDefault();
  const daySelect = document.getElementById('exDay');
  const day = String(daySelect.value);
  const secSelectVal = document.getElementById('exSectionSelect').value;
  const customSecName = document.getElementById('exCustomSection').value.trim();
  const sectionTitle = secSelectVal === '__NEW__' ? (customSecName || 'Custom Section') : secSelectVal;

  const title = document.getElementById('exTitle').value.trim();
  const target = document.getElementById('exTarget').value.trim();
  const exerciseType = document.getElementById('exType').value;
  const varLabel = document.getElementById('exVarLabel').value.trim();
  const scheme = document.getElementById('exScheme').value.trim();

  const category = 'cus_' + Date.now();
  const prefix = 'cp_' + Math.random().toString(36).substring(2, 7);
  const rest = exerciseType === 'compound' ? 150 : 75;

  const newEx = { 
    category, 
    prefix, 
    title, 
    target, 
    exerciseType, 
    varLabel, 
    scheme, 
    rest, 
    day: day, 
    sectionTitle 
  };

  const customList = getJ('iron_custom_exercises', []);
  customList.push(newEx);
  setJ('iron_custom_exercises', customList);
  
  // Persist the selected day so UI refreshes don't fall back to Day 1
  setL('iron_active_day', day);

  pushToCloud();

  closeAddExModal();
  rebuildWorkoutDatabase();
  renderAll();
  
  // Explicitly activate the day view
  switchDayView(day, false);
  showToast(`✨ Added "${title}" to Day ${day} (${sectionTitle})!`, 'success');
}

export function openAddVarModal(category) {
  activeAddVarCategory = category;
  const ex = FLAT_EXERCISES.find(e => e.category === category);
  if (!ex) return;
  document.getElementById('addVarModalTitle').textContent = `Add Variation: ${ex.title}`;
  document.getElementById('addVarForm').reset();
  document.getElementById('addVarModalOverlay').classList.add('active');
}

export function closeAddVarModal() {
  document.getElementById('addVarModalOverlay').classList.remove('active');
  activeAddVarCategory = null;
}

export function handleSaveNewVariation(e) {
  e.preventDefault();
  if (!activeAddVarCategory) return;
  const label = document.getElementById('newVarLabelInput').value.trim();
  const setup = document.getElementById('newVarSetupInput').value.trim();
  const cue = document.getElementById('newVarCueInput').value.trim();

  const value = 'var_' + Date.now();
  const newVarObj = {
    value,
    label,
    setup: setup ? '⚙️ Setup: ' + setup : '',
    cue: cue ? '💡 ' + cue : '',
    defaultSets: [[20, 10, 2, 'Working'], [20, 10, 1, 'Working']]
  };

  const customVars = getJ('iron_custom_variations', {});
  if (!customVars[activeAddVarCategory]) customVars[activeAddVarCategory] = [];
  customVars[activeAddVarCategory].push(newVarObj);
  setJ('iron_custom_variations', customVars);
  pushToCloud();

  closeAddVarModal();
  rebuildWorkoutDatabase();
  renderAll();
  switchDayView(activeDay, false);

  setChoice(activeAddVarCategory, value);
  const ex = FLAT_EXERCISES.find(e => e.category === activeAddVarCategory);
  if (ex) applyVariation(activeAddVarCategory, ex.prefix, value, true);

  showToast('✨ New equipment variation added!', 'success');
}

export function reorderEquipment(category, direction) {
  const ex = FLAT_EXERCISES.find(e => e.category === category);
  if (!ex || !ex.variations || ex.variations.length < 2) return;
  const select = document.getElementById(category + 'Select');
  if (!select) return;
  const currentVal = select.value;
  const currIdx = ex.variations.findIndex(v => v.value === currentVal);
  const newIdx = currIdx + direction;
  if (newIdx < 0 || newIdx >= ex.variations.length) return;

  const temp = ex.variations[currIdx];
  ex.variations[currIdx] = ex.variations[newIdx];
  ex.variations[newIdx] = temp;

  const orderMap = getJ('iron_var_order', {});
  orderMap[category] = ex.variations.map(v => v.value);
  setJ('iron_var_order', orderMap);
  pushToCloud();

  renderAll();
  switchDayView(activeDay, false);
  document.getElementById(category + 'Select').value = currentVal;
  applyVariation(category, ex.prefix, currentVal, true);
}

export async function removeEquipment(category) {
  const ex = FLAT_EXERCISES.find(e => e.category === category);
  if (!ex || !ex.variations || ex.variations.length <= 1) {
    showToast('Cannot remove the last remaining equipment variation.', 'error');
    return;
  }
  const select = document.getElementById(category + 'Select');
  if (!select) return;
  const currentVal = select.value;
  const varObj = ex.variations.find(v => v.value === currentVal);

  if (!(await confirmDialog(`Remove variation "${varObj ? varObj.label : currentVal}"?`, { confirmLabel: 'Remove', danger: true }))) return;

  const customVars = getJ('iron_custom_variations', {});
  if (customVars[category]) {
    customVars[category] = customVars[category].filter(v => v.value !== currentVal);
    if (customVars[category].length === 0) delete customVars[category];
    setJ('iron_custom_variations', customVars);
  }

  const hiddenVars = getJ('iron_hidden_variations', {});
  if (!hiddenVars[category]) hiddenVars[category] = [];
  hiddenVars[category].push(currentVal);
  setJ('iron_hidden_variations', hiddenVars);
  pushToCloud();

  rebuildWorkoutDatabase();
  renderAll();
  switchDayView(activeDay, false);
  showToast('🗑️ Equipment variation removed.', 'info');
}

export function openPresetModal(category) {
  const ex = FLAT_EXERCISES.find(e => e.category === category);
  if (!ex) return;
  const select = document.getElementById(category + 'Select');
  const variationValue = select ? select.value : ex.variations[0].value;
  const varObj = ex.variations.find(v => v.value === variationValue) || ex.variations[0];

  activePresetModalData = { category, variationValue };
  document.getElementById('presetModalTitle').textContent = `Edit Preset: ${ex.title} (${varObj.label})`;

  const stored = getPreset(category, variationValue);
  const sets = (stored && stored.length) ? stored : varObj.defaultSets;

  const tbody = document.getElementById('presetEditTbody');
  tbody.innerHTML = '';
  sets.forEach((s) => {
    addPresetRowDOM(s.weight, s.reps, s.tag);
  });
  document.getElementById('presetModalOverlay').classList.add('active');
}

export function closePresetModal() {
  document.getElementById('presetModalOverlay').classList.remove('active');
  activePresetModalData = null;
}

export function addPresetRowDOM(w='', r='', tag='Working') {
  const tbody = document.getElementById('presetEditTbody');
  const n = tbody.children.length + 1;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="set-num-cell">${n}</td>
    <td><input type="number" class="input-field preset-w" value="${esc(w)}" placeholder="kg" /></td>
    <td><input type="number" class="input-field preset-r" value="${esc(r)}" placeholder="reps" /></td>
    <td>
      <select class="set-tag preset-tag">
        <option value="Warmup" ${tag==='Warmup'?'selected':''}>Warmup</option>
        <option value="Working" ${tag==='Working'?'selected':''}>Working</option>
        <option value="Drop Set" ${tag==='Drop Set'?'selected':''}>Drop Set</option>
        <option value="Failure" ${tag==='Failure'?'selected':''}>Failure</option>
      </select>
    </td>
  `;
  tbody.appendChild(tr);
}

export function addPresetRow() { addPresetRowDOM(); }
export function removePresetRow() {
  const tbody = document.getElementById('presetEditTbody');
  if (tbody.children.length > 1) tbody.removeChild(tbody.lastElementChild);
}

export function saveActivePresetModal() {
  if (!activePresetModalData) return;
  const { category, variationValue } = activePresetModalData;
  const tbody = document.getElementById('presetEditTbody');
  const sets = [];
  tbody.querySelectorAll('tr').forEach(tr => {
    sets.push({
      weight: tr.querySelector('.preset-w').value === '' ? '' : parseFloat(tr.querySelector('.preset-w').value),
      reps: tr.querySelector('.preset-r').value === '' ? '' : parseInt(tr.querySelector('.preset-r').value, 10),
      tag: tr.querySelector('.preset-tag').value
    });
  });
  setPreset(category, variationValue, sets);
  closePresetModal();
  const ex = FLAT_EXERCISES.find(e => e.category === category);
  if (ex) applyVariation(category, ex.prefix, variationValue, true);
  pushToCloud();
  showToast('📌 Preset updated & synced!', 'success');
}

export async function removeExercise(category) {
  if (!(await confirmDialog('Remove this exercise from your workout day?', { confirmLabel: 'Remove', danger: true }))) return;
  const hidden = getJ('iron_hidden_exercises', []);
  if (!hidden.includes(category)) hidden.push(category);
  setJ('iron_hidden_exercises', hidden);
  pushToCloud();
  rebuildWorkoutDatabase();
  renderAll();
  switchDayView(activeDay, false);
  showToast('🗑️ Exercise removed from day.', 'info');
}

export function reorderExercise(category, direction) {
  let targetDay = null, targetSecIdx = -1, targetExIdx = -1;
  for (const dNum of Object.keys(WORKOUT)) {
    const day = WORKOUT[dNum];
    day.sections.forEach((sec, sIdx) => {
      const eIdx = sec.exercises.findIndex(e => e.category === category);
      if (eIdx !== -1) { targetDay = dNum; targetSecIdx = sIdx; targetExIdx = eIdx; }
    });
  }
  if (targetDay === null) return;
  const section = WORKOUT[targetDay].sections[targetSecIdx];
  const newExIdx = targetExIdx + direction;
  if (newExIdx < 0 || newExIdx >= section.exercises.length) return;

  // Swap elements
  const temp = section.exercises[targetExIdx];
  section.exercises[targetExIdx] = section.exercises[newExIdx];
  section.exercises[newExIdx] = temp;

  // Save by day + section title so index shifting doesn't break it
  const orderKey = `iron_order_${targetDay}_${section.title.replace(/\s+/g, '_')}`;
  const orderedCats = section.exercises.map(e => e.category);
  setJ(orderKey, orderedCats);

  const allOrders = getJ('iron_all_exercise_orders', {});
  allOrders[orderKey] = orderedCats;
  setJ('iron_all_exercise_orders', allOrders);
  pushToCloud();

  const formData = captureCurrentFormValues();
  rebuildWorkoutDatabase();
  renderAll();
  switchDayView(activeDay, false);
  restoreFormValues(formData);
}
export function toggleSuperset(category) {
  let links = getSupersetLinks();
  const existingIndex = links.findIndex(([a, b]) => a === category || b === category);
  if (existingIndex >= 0) links.splice(existingIndex, 1);
  else {
    const next = getNextCategory(category);
    if (next) links.push([category, next]);
  }
  setSupersetLinks(links);
  renderAll();
  switchDayView(activeDay, false);
}
