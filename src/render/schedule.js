import { confirmDialog } from '../dialog.js';
import { args } from '../actions.js';
import { WORKOUT_BASE } from '../data/exercises.js';
import { WORKOUT, getMicrocycle, rebuildWorkoutDatabase, setMicrocycle } from '../model.js';
import { populateHistoryDayFilter } from './history.js';
import { activeDay, captureCurrentFormValues, renderAll, restoreFormValues, switchDayView } from './workout.js';
import { esc, getJ, setJ } from '../storage.js';
import { getHistory } from '../history-store.js';
import { icon } from '../icons.js';
import { pushToCloud } from '../sync.js';
import { showToast } from '../ui.js';

export function renderScheduleRibbon() {
  const ribbon = document.getElementById('scheduleRibbon');
  const summaryEl = document.getElementById('microcycleSummary');
  if (!ribbon) return;

  const cycle = getMicrocycle();
  let liftCount = 0;
  let restCount = 0;

  const dayOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayOfWeekNames[new Date().getDay()];

  ribbon.innerHTML = cycle.map(item => {
    const isToday = item.full.toLowerCase() === todayName.toLowerCase();
    const todayClass = isToday ? 'today' : '';

    if (item.type === 'workout' && item.dayNum) {
      liftCount++;
      const label = WORKOUT[item.dayNum] ? WORKOUT[item.dayNum].title.replace('⚡ ', '').split('•')[0].trim() : `Day ${item.dayNum}`;
      return `
        <div class="sched-item ${todayClass}" data-on-click="switchDayView" data-args="${args(item.dayNum, true)}">
          <span class="sched-day-name">${esc(item.day)}</span>
          <span class="sched-dot lift"></span>
          <span class="sched-label" style="color:var(--accent)" title="${esc(label)}">${esc(label)}</span>
        </div>
      `;
    } else {
      restCount++;
      return `
        <div class="sched-item ${todayClass}" data-on-click="notifyRestDay" data-args="${args(item.full)}">
          <span class="sched-day-name">${esc(item.day)}</span>
          <span class="sched-dot"></span>
          <span class="sched-label" style="color:var(--muted)">Rest</span>
        </div>
      `;
    }
  }).join('');

  if (summaryEl) {
    summaryEl.textContent = `${liftCount} lift • ${restCount} rest`;
  }

  const dots = document.getElementById('weekDots');
  if (dots) {
    dots.innerHTML = cycle.map(item => {
      const lift = item.type === 'workout' && item.dayNum;
      const today = item.full.toLowerCase() === todayName.toLowerCase();
      return `<span class="week-dot ${lift ? 'lift' : ''} ${today ? 'today' : ''}" title="${esc(item.full)}: ${lift ? 'lift' : 'rest'}">${esc(item.day.charAt(0))}</span>`;
    }).join('');
  }
  renderHomeSummary(); // the plan's workout count may have changed
}

export function openMicrocycleModal() {
  const container = document.getElementById('microcycleDaysList');
  if (!container) return;

  const cycle = getMicrocycle();
  const workoutDays = Object.keys(WORKOUT);

  container.innerHTML = cycle.map((item, idx) => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(15,23,42,0.8); padding:10px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.08);">
      <span style="font-weight:700; font-size:14px;">${esc(item.full)}</span>
      <select class="machine-dropdown" id="microcycle_select_${idx}" style="min-width:180px; padding:8px 12px; font-size:13px;">
        <option value="rest" ${item.type === 'rest' ? 'selected' : ''}>Rest Day</option>
        ${workoutDays.map(d => `
          <option value="${d}" ${item.type === 'workout' && String(item.dayNum) === String(d) ? 'selected' : ''}>
            Day ${d}: ${esc(WORKOUT[d].title.replace('⚡ ', ''))}
          </option>
        `).join('')}
      </select>
    </div>
  `).join('');

  document.getElementById('microcycleModalOverlay').classList.add('active');
}

export function closeMicrocycleModal() {
  document.getElementById('microcycleModalOverlay').classList.remove('active');
}

export function saveMicrocycleConfig() {
  const cycle = getMicrocycle();
  const updated = cycle.map((item, idx) => {
    const el = document.getElementById(`microcycle_select_${idx}`);
    const val = el ? el.value : 'rest';
    if (val === 'rest') {
      return { ...item, type: 'rest', dayNum: null };
    } else {
      return { ...item, type: 'workout', dayNum: val };
    }
  });

  setMicrocycle(updated);
  renderScheduleRibbon();
  closeMicrocycleModal();
  showToast('📅 Weekly microcycle updated!', 'success');
}

export function renderDayNav() {
  const container = document.getElementById('dayNavContainer');
  if (!container) return;
  const days = Object.keys(WORKOUT);

  let html = days.map((d) => {
    const cfg = WORKOUT[d];
    return `
      <button class="nav-btn day-${d} ${String(d) === String(activeDay) ? 'active' : ''}" data-on-click="switchDayView" data-args="${args(d, true)}">
        <span>Day ${d}</span>
        <span style="font-size: 11px; opacity: 0.75; font-weight: 500;">(${esc(cfg.title.replace('⚡ ', '').split('•')[0].trim())})</span>
      </button>
    `;
  }).join('');

  html += `<button class="nav-btn-add edit-only" data-on-click="openAddDayModal">${icon('plus', 14)} Add Day</button>`;
  container.innerHTML = html;
}

export function openAddDayModal() {
  document.getElementById('addDayForm').reset();
  document.getElementById('addDayModalOverlay').classList.add('active');
}
export function closeAddDayModal() {
  document.getElementById('addDayModalOverlay').classList.remove('active');
}
export function handleSaveCustomDay(e) {
  e.preventDefault();
  const title = document.getElementById('newDayTitle').value.trim();
  const sub = document.getElementById('newDaySub').value.trim();
  const initialSec = document.getElementById('newDayInitialSec').value.trim();

  const customDays = getJ('iron_custom_days', []);
  const allDayKeys = Object.keys(WORKOUT).map(k => isNaN(k) ? 0 : Number(k));
  const nextDayNum = (Math.max(0, ...allDayKeys) + 1).toString();

  const newDay = {
    dayNum: nextDayNum,
    title: '⚡ ' + title,
    badge: `Day ${nextDayNum} Focus`,
    badgeClass: 'badge-d' + nextDayNum,
    sub: sub,
    sections: [
      {
        title: initialSec || 'Primary Focus',
        tag: `d${nextDayNum}_tag_sec1`,
        color: 'red',
        exercises: []
      }
    ]
  };

  customDays.push(newDay);
  setJ('iron_custom_days', customDays);
  pushToCloud();

  closeAddDayModal();
  rebuildWorkoutDatabase();
  renderAll();
  switchDayView(nextDayNum, true);
  populateHistoryDayFilter();
  showToast(`✨ Added new workout day: Day ${nextDayNum}!`, 'success');
}

export function openAddSecModal() {
  const sel = document.getElementById('secTargetDay');
  if (sel) {
    sel.innerHTML = Object.keys(WORKOUT).map(d => `<option value="${d}" ${String(d) === String(activeDay) ? 'selected' : ''}>Day ${d}: ${esc(WORKOUT[d].title.replace('⚡ ', ''))}</option>`).join('');
  }
  document.getElementById('secNameInput').value = '';
  document.getElementById('addSecModalOverlay').classList.add('active');
}
export function closeAddSecModal() {
  document.getElementById('addSecModalOverlay').classList.remove('active');
}
export function handleSaveNewSection(e) {
  e.preventDefault();
  const dayNum = document.getElementById('secTargetDay').value;
  const name = document.getElementById('secNameInput').value.trim();
  const color = document.getElementById('secColorSelect').value;

  if (!name) return;

  const customSecs = getJ('iron_custom_sections', []);
  const newSec = {
    day: dayNum,
    title: name,
    color: color,
    tag: 'sec_' + Date.now(),
    exercises: []
  };

  customSecs.push(newSec);
  setJ('iron_custom_sections', customSecs);
  pushToCloud();

  closeAddSecModal();
  rebuildWorkoutDatabase();
  renderAll();
  switchDayView(dayNum, false);
  showToast(`📑 Added section: ${name}!`, 'success');
}

export async function deleteCurrentSplit() {
  const currentKey = String(activeDay);
  const splitTitle = WORKOUT[currentKey] ? WORKOUT[currentKey].title : `Day ${currentKey}`;

  const allDays = Object.keys(WORKOUT);
  if (allDays.length <= 1) {
    showToast('You must keep at least one workout day.', 'error');
    return;
  }

  if (!(await confirmDialog(`Permanently delete "${splitTitle}"? All custom exercises and settings assigned to this day will be removed.`, { confirmLabel: 'Delete day', danger: true }))) {
    return;
  }

  let customDays = getJ('iron_custom_days', []);
  customDays = customDays.filter(cd => String(cd.dayNum) !== currentKey);
  setJ('iron_custom_days', customDays);

  let hiddenDays = getJ('iron_hidden_days', []);
  if (WORKOUT_BASE[currentKey] && !hiddenDays.includes(currentKey)) {
    hiddenDays.push(currentKey);
    setJ('iron_hidden_days', hiddenDays);
  }

  let customExs = getJ('iron_custom_exercises', []);
  customExs = customExs.filter(e => String(e.day) !== currentKey);
  setJ('iron_custom_exercises', customExs);

  let customSecs = getJ('iron_custom_sections', []);
  customSecs = customSecs.filter(s => String(s.day) !== currentKey);
  setJ('iron_custom_sections', customSecs);

  let cycle = getMicrocycle();
  cycle = cycle.map(item => {
    if (String(item.dayNum) === currentKey) {
      return { ...item, type: 'rest', dayNum: null };
    }
    return item;
  });
  setMicrocycle(cycle);

  rebuildWorkoutDatabase();

  const remainingDays = Object.keys(WORKOUT);
  const nextDay = remainingDays[0] || '1';
  switchDayView(nextDay, true);

  renderAll();
  renderScheduleRibbon();
  pushToCloud();

  showToast(`🗑️ Deleted ${splitTitle}`, 'info');
}

export async function removeSection(dayNum, secIdx) {
  const dayObj = WORKOUT[dayNum];
  if (!dayObj || !dayObj.sections || !dayObj.sections[secIdx]) return;
  const sec = dayObj.sections[secIdx];
  const secTitle = sec.title || 'Undefined';

  if (!(await confirmDialog(`Remove the section "${secTitle}" and all its exercises?`, { confirmLabel: 'Remove', danger: true }))) return;

  const hiddenExs = getJ('iron_hidden_exercises', []);
  if (sec.exercises) {
    sec.exercises.forEach(ex => {
      if (!hiddenExs.includes(ex.category)) hiddenExs.push(ex.category);
    });
  }
  setJ('iron_hidden_exercises', hiddenExs);

  let customExs = getJ('iron_custom_exercises', []);
  customExs = customExs.filter(e => !(String(e.day) === String(dayNum) && (e.sectionTitle === sec.title || !e.sectionTitle || e.sectionTitle === 'undefined')));
  setJ('iron_custom_exercises', customExs);

  let customSecs = getJ('iron_custom_sections', []);
  customSecs = customSecs.filter(s => !(String(s.day) === String(dayNum) && s.title === sec.title));
  setJ('iron_custom_sections', customSecs);

  let customDays = getJ('iron_custom_days', []);
  const cDay = customDays.find(cd => String(cd.dayNum) === String(dayNum));
  if (cDay && cDay.sections) {
    cDay.sections = cDay.sections.filter((_, idx) => idx !== secIdx);
    setJ('iron_custom_days', customDays);
  }

  const sectionOrders = getJ('iron_section_orders', {});
  if (sectionOrders[dayNum]) {
    sectionOrders[dayNum] = sectionOrders[dayNum].filter(t => t !== sec.title && t !== 'undefined');
    setJ('iron_section_orders', sectionOrders);
  }

  rebuildWorkoutDatabase();
  renderAll();
  switchDayView(activeDay, false);
  pushToCloud();
  showToast(`🗑️️ Removed section: ${secTitle}`, 'info');
}

export function reorderSection(dayNum, secIdx, direction) {
  const dayObj = WORKOUT[dayNum];
  if (!dayObj || !dayObj.sections) return;
  const newIdx = secIdx + direction;
  if (newIdx < 0 || newIdx >= dayObj.sections.length) return;

  const temp = dayObj.sections[secIdx];
  dayObj.sections[secIdx] = dayObj.sections[newIdx];
  dayObj.sections[newIdx] = temp;

  const sectionOrders = getJ('iron_section_orders', {});
  sectionOrders[dayNum] = dayObj.sections.map(s => s.title);
  setJ('iron_section_orders', sectionOrders);
  pushToCloud();

  const formData = captureCurrentFormValues();
  rebuildWorkoutDatabase();
  renderAll();
  switchDayView(activeDay, false);
  restoreFormValues(formData);
  showToast('🔄 Section reordered!', 'success');
}

export function notifyRestDay(d) { showToast(`${d} is a rest day. Rest and recover!`, 'info'); }

export function restoreAllHiddenExercises() {
  setJ('iron_hidden_exercises', []);
  setJ('iron_hidden_variations', {});
  setJ('iron_hidden_days', []);
  setJ('iron_custom_sections', []);
  pushToCloud();
  rebuildWorkoutDatabase();
  renderAll();
  switchDayView('1', true);
  showToast('♻️ All exercises & default days restored!', 'success');
}

// ---- Header line under the logo: today's date, this week's workouts against the plan, and the streak.
function localDate(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return y ? new Date(y, m - 1, d) : null;
}

// Monday 00:00 of the week `date` falls in.
function weekStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// Weeks in a row with at least one workout. The current week only counts once it has one,
// so the streak doesn't look broken on a Monday.
export function weekStreak(dates, today = new Date()) {
  const weeks = new Set(dates.map(localDate).filter(Boolean).map(d => weekStart(d).getTime()));
  const w = weekStart(today);
  if (!weeks.has(w.getTime())) w.setDate(w.getDate() - 7);
  let streak = 0;
  while (weeks.has(w.getTime())) { streak++; w.setDate(w.getDate() - 7); }
  return streak;
}

export function renderHomeSummary() {
  const el = document.getElementById('homeSummary');
  if (!el) return;
  const today = new Date();
  const dates = getHistory().map(h => h.date);
  const start = weekStart(today).getTime();
  const done = dates.filter(d => { const t = localDate(d); return t && t.getTime() >= start; }).length;
  const planned = getMicrocycle().filter(d => d.type === 'workout').length;
  const streak = weekStreak(dates, today);
  const parts = [today.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })];
  parts.push(planned ? `${done} of ${planned} this week` : `${done} this week`);
  if (streak >= 2) parts.push(`🔥 ${streak}-week streak`);
  el.textContent = parts.join(' · ');
}
