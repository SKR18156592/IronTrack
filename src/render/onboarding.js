import { args } from '../actions.js';
import { WORKOUT, getMicrocycle, setMicrocycle } from '../model.js';
import {
  ACTIVITY_LEVELS,
  GOALS,
  dailyTargets,
  hasBodyMetrics,
  isWorkoutDay,
  readProfile,
  workoutDaysPerWeek
} from '../nutrition-targets.js';
import { esc, getL, setL } from '../storage.js';
import { pushToCloud } from '../sync.js';
import { refreshAllUI } from '../ui.js';
import { loadProfileTabUI } from './profile.js';

// First-run setup: about you, goal, training days, then the targets that come out of them. Shown once,
// when the profile has no body metrics (a returning user's synced profile skips it). Skippable.

const DONE_KEY = 'iron_onboarded'; // '1' once finished or skipped; synced, so other devices skip it too
const STEPS = ['about', 'goal', 'days', 'done'];
let step = 0;

// The schedule with `days` (full weekday names) as workout days and the rest as rest days. Unchanged when
// those already are the workout days; otherwise the plan's workouts are dealt out in weekday order
// (1, 2, 3, 1, ...), so the same workout doesn't land on back-to-back days.
export function scheduleWithDays(cycle, days, workoutDayNums) {
  const chosen = new Set(days);
  const current = cycle.filter(d => d.type === 'workout').map(d => d.full);
  if (current.length === chosen.size && current.every(d => chosen.has(d))) return cycle;
  let next = 0;
  return cycle.map(item => {
    if (!chosen.has(item.full)) return { ...item, type: 'rest', dayNum: null };
    const dayNum = workoutDayNums.length ? workoutDayNums[next++ % workoutDayNums.length] : null;
    return { ...item, type: 'workout', dayNum };
  });
}

export function maybeStartOnboarding() {
  const blocked = ['authOverlay', 'resetOverlay'].some(id => document.getElementById(id)?.classList.contains('active'));
  if (blocked || getL(DONE_KEY, '') === '1' || hasBodyMetrics(readProfile())) return;
  step = 0;
  render();
  document.getElementById('onboardOverlay').classList.add('active');
}

function finish() {
  setL(DONE_KEY, '1');
  document.getElementById('onboardOverlay').classList.remove('active');
  pushToCloud();
  refreshAllUI();
  loadProfileTabUI();
}

export const skipOnboarding = () => finish();

export function finishOnboarding(e) {
  e?.preventDefault();
  finish();
}

export function onboardBack() {
  step = Math.max(0, step - 1);
  render();
}

const value = id => document.getElementById(id)?.value ?? '';
const inRange = (v, lo, hi) => v >= lo && v <= hi;

function showError(text) {
  const el = document.getElementById('onboardError');
  el.textContent = text;
  el.hidden = false;
}

// Saves the current step, then moves on.
export function onboardNext(e) {
  e?.preventDefault();
  const name = STEPS[step];
  if (name === 'about') {
    const age = parseFloat(value('obAge')),
      height = parseFloat(value('obHeight')),
      weight = parseFloat(value('obWeight'));
    if (!inRange(age, 13, 100)) return showError('Enter your age in years (13–100).');
    if (!inRange(height, 120, 230)) return showError('Enter your height in cm (120–230).');
    if (!inRange(weight, 30, 300)) return showError('Enter your weight in kg (30–300).');
    setL('iron_profile_sex', value('obSex') === 'female' ? 'female' : 'male');
    setL('iron_profile_age', String(age));
    setL('iron_profile_height', String(height));
    setL('iron_profile_weight', String(weight));
  } else if (name === 'goal') {
    const goal = GOALS[value('obGoal')] ? value('obGoal') : 'maintain';
    setL('iron_nutrition_goal', goal);
    setL(
      'iron_nutrition_rate',
      String(GOALS[goal].rates.includes(Number(value('obRate'))) ? value('obRate') : GOALS[goal].defaultRate)
    );
    if (ACTIVITY_LEVELS.some(a => a.value === value('obActivity'))) setL('iron_profile_activity', value('obActivity'));
  } else if (name === 'days') {
    const days = [...document.querySelectorAll('#onboardBody input[name="obDay"]:checked')].map(el => el.value);
    setMicrocycle(scheduleWithDays(getMicrocycle(), days, Object.keys(WORKOUT)));
  }
  step = Math.min(STEPS.length - 1, step + 1);
  render();
}

// Re-renders the goal step when the goal changes (the rates depend on it).
export function onboardGoalChanged() {
  render({ goal: value('obGoal'), activity: value('obActivity') });
}

const options = (list, selected) =>
  list
    .map(
      ([v, label]) =>
        `<option value="${esc(v)}"${String(v) === String(selected) ? ' selected' : ''}>${esc(label)}</option>`
    )
    .join('');

function render(override = {}) {
  const body = document.getElementById('onboardBody');
  if (!body) return;
  const p = readProfile();
  const name = STEPS[step];
  let html = '';
  if (name === 'about') {
    html = `
      <h2 class="onboard-title">Welcome to IronTrack</h2>
      <p class="onboard-hint">A few details to set your calorie and protein targets. They stay in your profile.</p>
      <div class="onboard-grid">
        <label>Sex (for the calorie formula)<select id="obSex" class="machine-dropdown">${options(
          [
            ['male', 'Male'],
            ['female', 'Female']
          ],
          p.sex
        )}</select></label>
        <label>Age<input id="obAge" type="number" class="input-field" inputmode="numeric" placeholder="years" value="${p.age ?? ''}" /></label>
        <label>Height<input id="obHeight" type="number" class="input-field" inputmode="decimal" placeholder="cm" value="${p.height ?? ''}" /></label>
        <label>Weight<input id="obWeight" type="number" class="input-field" inputmode="decimal" step="0.1" placeholder="kg" value="${p.weight ?? ''}" /></label>
      </div>`;
  } else if (name === 'goal') {
    const goal = GOALS[override.goal] ? override.goal : p.goal;
    const rates = GOALS[goal].rates;
    html = `
      <h2 class="onboard-title">What's your goal?</h2>
      <p class="onboard-hint">You can change this any time on the Nutrition tab.</p>
      <div class="onboard-grid">
        <label>Goal<select id="obGoal" class="machine-dropdown" data-on-change="onboardGoalChanged">${options(
          Object.entries(GOALS).map(([k, g]) => [k, g.label]),
          goal
        )}</select></label>
        ${
          rates.length > 1
            ? `<label>Rate<select id="obRate" class="machine-dropdown">${options(
                rates.map(r => [r, `${r} kg / week`]),
                goal === p.goal ? p.rate : GOALS[goal].defaultRate
              )}</select></label>`
            : ''
        }
        <label class="onboard-wide">Activity level<select id="obActivity" class="machine-dropdown">${options(
          ACTIVITY_LEVELS.map(a => [a.value, a.label]),
          override.activity || String(p.activity)
        )}</select></label>
      </div>`;
  } else if (name === 'days') {
    const cycle = getMicrocycle();
    html = `
      <h2 class="onboard-title">Which days do you train?</h2>
      <p class="onboard-hint">Workout days get a little more food. Change the plan for each day later in your schedule.</p>
      <div class="onboard-days">${cycle
        .map(
          d =>
            `<label class="onboard-day"><input type="checkbox" name="obDay" value="${esc(d.full)}"${
              d.type === 'workout' ? ' checked' : ''
            } /><span>${esc(d.day)}</span></label>`
        )
        .join('')}</div>`;
  } else {
    const cycle = getMicrocycle();
    const days = workoutDaysPerWeek(cycle);
    const t = hasBodyMetrics(p) ? dailyTargets(p, isWorkoutDay(cycle) ? 'workout' : 'rest', days) : null;
    html = `
      <h2 class="onboard-title">You're set</h2>
      ${
        t
          ? `<p class="onboard-hint">Today's targets, from your profile and goal:</p>
             <div class="macro-summary onboard-targets">
               <div class="macro-tile"><span>Calories</span><strong>${t.kcal.toLocaleString('en-US')}</strong></div>
               <div class="macro-tile"><span>Protein</span><strong>${t.protein} g</strong></div>
             </div>
             ${t.floored ? '<p class="onboard-hint">That’s your BMR, the lowest target IronTrack sets. A slower rate gets you a little more.</p>' : ''}`
          : ''
      }
      <p class="onboard-hint">${days} training day${days === 1 ? '' : 's'} a week. Log your workouts on the Workout tab and your meals on the Nutrition tab.</p>`;
  }

  const last = step === STEPS.length - 1;
  body.innerHTML = `
    <div class="onboard-progress" aria-label="Step ${step + 1} of ${STEPS.length}">${STEPS.map(
      (_, i) => `<span class="${i <= step ? 'on' : ''}"></span>`
    ).join('')}</div>
    <form class="onboard-form" data-on-submit="${last ? 'finishOnboarding' : 'onboardNext'}" data-args="${args('$event')}">
      ${html}
      <div id="onboardError" class="onboard-error" hidden></div>
      <div class="onboard-buttons">
        ${step > 0 && !last ? '<button type="button" class="btn btn-secondary" data-on-click="onboardBack">Back</button>' : ''}
        <button type="submit" class="btn btn-primary">${last ? 'Start training' : 'Next'}</button>
      </div>
      ${last ? '' : '<button type="button" class="onboard-skip" data-on-click="skipOnboarding">Skip for now</button>'}
    </form>`;
  body.querySelector('input, select')?.focus();
}
