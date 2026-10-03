import { FOODS } from '../data/foods.js';
import { getMicrocycle } from '../model.js';
import {
  addEntries,
  dayTotals,
  entriesOn,
  getNutritionLog,
  localDate,
  removeEntry,
  shiftDate,
  weightSeries
} from '../nutrition-log.js';
import {
  dailyTargets,
  foodNutrients,
  hasBodyMetrics,
  isWorkoutDay,
  readProfile,
  workoutDaysPerWeek
} from '../nutrition-targets.js';
import { args } from '../actions.js';
import { esc, getL, setL } from '../storage.js';
import { pushToCloud } from '../sync.js';
import { showToast } from '../ui.js';
import { plannedMeals, renderNutritionPlan } from './nutrition.js';

// The daily log card on the Nutrition tab: progress against the day's targets, water, body weight,
// and what was eaten.

const WATER_STEP_ML = 250;
const WATER_ML_PER_KG = 35;
const DEFAULT_WATER_ML = 2500;

let logDate = null; // null: today

const currentDate = () => logDate || localDate();
const dateObj = date => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const unitLabel = food => (food.unit === 'piece' ? '' : ' ' + food.unit);
const kcal = v => Math.round(v).toLocaleString('en-US');

function changed() {
  pushToCloud();
  renderNutritionPlan();
}

export function shiftLogDate(days) {
  const next = shiftDate(currentDate(), Number(days));
  logDate = next >= localDate() ? null : next;
  renderNutritionPlan();
}

export function logFoodSelected(id) {
  const food = FOODS[id];
  if (!food) return;
  document.getElementById('logFoodAmount').value = food.per;
  document.getElementById('logFoodUnit').textContent = food.unit === 'piece' ? 'pieces' : food.unit;
}

function foodEntry(id, amount, meal) {
  const food = FOODS[id];
  const n = foodNutrients(food, amount);
  const round1 = v => Math.round(v * 10) / 10;
  return {
    type: 'food',
    date: currentDate(),
    food: id,
    name: food.name,
    amount,
    unit: food.unit,
    kcal: Math.round(n.kcal),
    p: round1(n.p),
    c: round1(n.c),
    f: round1(n.f),
    ...(meal ? { meal } : {})
  };
}

export function addLoggedFood(e) {
  e.preventDefault();
  const id = document.getElementById('logFood').value;
  const amount = parseFloat(document.getElementById('logFoodAmount').value);
  if (!FOODS[id] || !(amount > 0)) {
    showToast('Pick a food and an amount.', 'error');
    return;
  }
  addEntries([foodEntry(id, amount)]);
  changed();
}

export function logPlannedMeal(index) {
  const meal = plannedMeals()[Number(index)];
  if (!meal) return;
  addEntries(meal.items.map(([id, amount]) => foodEntry(id, amount, meal.title)));
  showToast(`✅ Logged ${meal.title}`, 'success');
  changed();
}

export function addWater(ml) {
  addEntries([{ type: 'water', date: currentDate(), ml: Number(ml) }]);
  changed();
}

// Removes the day's most recent water entry.
export function undoWater() {
  const last = entriesOn(getNutritionLog(), currentDate())
    .filter(e => e.type === 'water')
    .pop();
  if (last && removeEntry(last.id)) changed();
}

export function saveLoggedWeight(e) {
  e.preventDefault();
  const kg = parseFloat(document.getElementById('logWeight').value);
  if (!(kg > 20 && kg < 400)) {
    showToast('Enter your weight in kg.', 'error');
    return;
  }
  const date = currentDate();
  const latest = weightSeries(getNutritionLog()).pop();
  addEntries([{ type: 'weight', date, kg }]);
  // The newest weight is the profile's weight, so the targets follow it.
  if (!latest || date >= latest.date) {
    setL('iron_profile_weight', String(kg));
    ['profileTabWeight', 'bodyWeight', 'calcWeight'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = kg;
    });
  }
  showToast('⚖️ Weight logged', 'success');
  changed();
}

export function removeLogEntry(id) {
  if (removeEntry(id)) changed();
}

function bar(label, value, target, unit) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = target && value > target * 1.05;
  return `
    <div class="log-bar">
      <div class="log-bar-label"><span>${label}</span>
        <span class="log-bar-value${over ? ' over' : ''}">${kcal(value)}${target ? ` / ${kcal(target)}` : ''} ${unit}</span></div>
      <div class="log-bar-track"><div class="log-bar-fill" style="width: ${pct}%"></div></div>
    </div>`;
}

export function renderNutritionLog() {
  const card = document.getElementById('nutriLogCard');
  if (!card) return;
  const date = currentDate();
  const today = localDate();
  const log = getNutritionLog();
  const totals = dayTotals(log, date);
  const profile = readProfile();
  const microcycle = getMicrocycle();
  const target = hasBodyMetrics(profile)
    ? dailyTargets(
        profile,
        isWorkoutDay(microcycle, dateObj(date)) ? 'workout' : 'rest',
        workoutDaysPerWeek(microcycle)
      )
    : null;
  const waterTarget = profile.weight ? Math.round((profile.weight * WATER_ML_PER_KG) / 50) * 50 : DEFAULT_WATER_ML;
  const label =
    date === today
      ? 'Today'
      : date === shiftDate(today, -1)
        ? 'Yesterday'
        : dateObj(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const foods = entriesOn(log, date).filter(e => e.type === 'food');
  const list = foods.length
    ? foods
        .map(
          e => `
      <li class="log-entry">
        <span class="log-entry-name">${esc(e.name)} <span class="food-amount">${e.amount}${e.unit === 'piece' ? '' : ' ' + esc(e.unit)}</span>
          ${e.meal ? `<span class="log-entry-meal">${esc(e.meal)}</span>` : ''}</span>
        <span class="log-entry-kcal">${kcal(e.kcal)} kcal · P ${Math.round(e.p)}g</span>
        <button class="btn-xs" aria-label="Remove" data-on-click="removeLogEntry" data-args="${args(e.id)}">✕</button>
      </li>`
        )
        .join('')
    : '<li class="log-empty">Nothing logged yet. Add a food below, or log a meal from the plan.</li>';

  const selected = document.getElementById('logFood')?.value || 'chicken_breast';
  const options = Object.entries(FOODS)
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(
      ([id, f]) =>
        `<option value="${id}"${id === selected ? ' selected' : ''}>${esc(f.name)} (${f.per}${unitLabel(f)})</option>`
    )
    .join('');
  const food = FOODS[selected];

  card.innerHTML = `
    <div class="analytics-header nutri-header">
      <span>Food log</span>
      <div class="log-date-nav">
        <button class="btn-xs" aria-label="Previous day" data-on-click="shiftLogDate" data-args="${args(-1)}">‹</button>
        <strong>${label}</strong>
        <button class="btn-xs" aria-label="Next day" data-on-click="shiftLogDate" data-args="${args(1)}"${date === today ? ' disabled' : ''}>›</button>
      </div>
    </div>
    <div class="log-bars">
      ${bar('Calories', totals.kcal, target?.kcal, 'kcal')}
      ${bar('Protein', totals.p, target?.protein, 'g')}
      ${bar('Carbs', totals.c, target?.carbs, 'g')}
      ${bar('Fat', totals.f, target?.fat, 'g')}
    </div>
    <div class="log-row">
      <div class="log-water">
        ${bar('Water', totals.water, waterTarget, 'ml')}
        <div class="log-water-buttons">
          <button class="btn btn-secondary btn-sm" data-on-click="addWater" data-args="${args(WATER_STEP_ML)}">+ ${WATER_STEP_ML} ml</button>
          <button class="btn btn-secondary btn-sm" data-on-click="undoWater"${totals.water ? '' : ' disabled'}>Undo</button>
        </div>
      </div>
      <form class="log-weight" data-on-submit="saveLoggedWeight" data-args="${args('$event')}">
        <label for="logWeight">Body weight${totals.weight ? `: <strong>${totals.weight} kg</strong>` : ''}</label>
        <div class="log-inline">
          <input type="number" id="logWeight" class="input-field" step="0.1" placeholder="${esc(totals.weight || getL('iron_profile_weight', '') || 'kg')}" />
          <button class="btn btn-secondary btn-sm" type="submit">Log</button>
        </div>
      </form>
    </div>
    <ul class="log-list">${list}</ul>
    <form class="log-add" data-on-submit="addLoggedFood" data-args="${args('$event')}">
      <select id="logFood" class="machine-dropdown" data-on-change="logFoodSelected" data-args="${args('$value')}">${options}</select>
      <div class="log-inline">
        <input type="number" id="logFoodAmount" class="input-field" min="0" step="any" value="${food.per}" aria-label="Amount" />
        <span id="logFoodUnit" class="log-unit">${food.unit === 'piece' ? 'pieces' : food.unit}</span>
        <button class="btn btn-primary btn-sm" type="submit">Add</button>
      </div>
    </form>`;
}
