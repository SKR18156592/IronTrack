import { args } from '../actions.js';
import { confirmDialog } from '../dialog.js';
import {
  UNITS,
  addCustomFood,
  deleteCustomFood,
  getCustomFoods,
  getFoods,
  resetPlan,
  savePlan
} from '../meal-plans.js';
import { foodNutrients, mealNutrients, planNutrients } from '../nutrition-targets.js';
import { esc } from '../storage.js';
import { pushToCloud } from '../sync.js';
import { showToast } from '../ui.js';
import { plannedMeals, renderNutritionPlan, shownPlanMode } from './nutrition.js';

// Editing the meal plan shown on the Nutrition tab. Changes go to a draft; Save makes it the user's plan
// for that day type (the example plan, scaled to their targets, is the starting point).

let draft = null; // meals being edited, or null when not editing
let draftMode = 'rest';

export const isEditingPlan = () => !!draft;

export function stopPlanEdit() {
  draft = null;
}

export function startPlanEdit() {
  draft = structuredClone(plannedMeals());
  draftMode = shownPlanMode();
  renderNutritionPlan();
}

export function cancelPlanEdit() {
  draft = null;
  renderNutritionPlan();
}

export function savePlanEdit() {
  savePlan(draftMode, draft);
  draft = null;
  pushToCloud();
  showToast('✅ Meal plan saved', 'success');
  renderNutritionPlan();
}

export async function resetMealPlan() {
  const ok = await confirmDialog('Replace your plan with the example plan, scaled to your targets?', {
    confirmLabel: 'Use example',
    danger: true
  });
  if (!ok) return;
  resetPlan(shownPlanMode());
  pushToCloud();
  renderNutritionPlan();
}

const edited = () => renderNutritionPlan();

export function planRenameMeal(i, title) {
  draft[i].title = String(title).trim() || 'Meal';
  edited();
}

export function planSetAmount(i, j, value) {
  const amount = parseFloat(value);
  if (amount > 0) draft[i].items[j][1] = amount;
  edited();
}

export function planRemoveItem(i, j) {
  draft[i].items.splice(j, 1);
  edited();
}

export function planAddItem(e, i) {
  e.preventDefault();
  const form = e.target;
  const id = form.querySelector('select').value;
  const amount = parseFloat(form.querySelector('input').value);
  const food = getFoods()[id];
  if (!food) return;
  draft[i].items.push([id, amount > 0 ? amount : food.per]);
  edited();
}

export function planAddMeal() {
  draft.push({ title: `Meal ${draft.length + 1}`, items: [] });
  edited();
}

export function planRemoveMeal(i) {
  draft.splice(i, 1);
  edited();
}

export function planMoveMeal(i, dir) {
  const j = i + Number(dir);
  if (j < 0 || j >= draft.length) return;
  [draft[i], draft[j]] = [draft[j], draft[i]];
  edited();
}

export function addCustomFoodFromForm(e) {
  e.preventDefault();
  const form = e.target;
  const value = name => form.querySelector(`[name="${name}"]`).value;
  const id = addCustomFood({
    name: value('name'),
    unit: value('unit'),
    per: parseFloat(value('per')),
    kcal: parseFloat(value('kcal')),
    p: parseFloat(value('p')),
    c: parseFloat(value('c')),
    f: parseFloat(value('f'))
  });
  if (!id) {
    showToast('Give the food a name, an amount, and its calories.', 'error');
    return;
  }
  pushToCloud();
  showToast('✅ Food added', 'success');
  edited();
}

export async function removeCustomFood(id) {
  const food = getCustomFoods()[id];
  if (!food) return;
  const ok = await confirmDialog(`Delete "${food.name}"? It's also removed from your saved meal plans.`, {
    confirmLabel: 'Delete',
    danger: true
  });
  if (!ok) return;
  deleteCustomFood(id);
  if (draft) draft.forEach(m => (m.items = m.items.filter(([fid]) => fid !== id)));
  pushToCloud();
  edited();
}

const kcal = v => Math.round(v).toLocaleString('en-US');
const unitText = food => (food.unit === 'piece' ? 'pcs' : food.unit);

function foodOptions(foods) {
  return Object.entries(foods)
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(([id, f]) => `<option value="${id}">${esc(f.name)}${f.custom ? ' (yours)' : ''}</option>`)
    .join('');
}

export function renderPlanEditor(foods) {
  const container = document.getElementById('nutritionMealsContainer');
  if (!container || !draft) return;
  const total = planNutrients(draft, foods);
  const options = foodOptions(foods);

  const meals = draft
    .map((meal, i) => {
      const sum = mealNutrients(meal, foods);
      const items = meal.items
        .map(([id, amount], j) => {
          const food = foods[id];
          return `
          <li class="plan-item">
            <span class="plan-item-name">${esc(food.name)}</span>
            <span class="log-inline plan-item-amount">
              <input type="number" class="input-field" min="0" step="any" value="${amount}" aria-label="Amount"
                data-on-change="planSetAmount" data-args="${args(i, j, '$value')}" />
              <span class="log-unit">${unitText(food)}</span>
            </span>
            <span class="log-entry-kcal">${kcal(foodNutrients(food, amount).kcal)} kcal</span>
            <button class="btn-xs" aria-label="Remove" data-on-click="planRemoveItem" data-args="${args(i, j)}">✕</button>
          </li>`;
        })
        .join('');
      return `
      <div class="meal-box">
        <div class="meal-header-row">
          <input class="input-field plan-meal-title" value="${esc(meal.title)}" aria-label="Meal name"
            data-on-change="planRenameMeal" data-args="${args(i, '$value')}" />
          <div class="meal-badge-summary">${kcal(sum.kcal)} kcal • ${Math.round(sum.p)}g Protein</div>
          <div class="plan-meal-buttons">
            <button class="btn-xs" aria-label="Move up" data-on-click="planMoveMeal" data-args="${args(i, -1)}"${i === 0 ? ' disabled' : ''}>↑</button>
            <button class="btn-xs" aria-label="Move down" data-on-click="planMoveMeal" data-args="${args(i, 1)}"${i === draft.length - 1 ? ' disabled' : ''}>↓</button>
            <button class="btn-xs btn-xs-danger" aria-label="Remove meal" data-on-click="planRemoveMeal" data-args="${args(i)}">✕</button>
          </div>
        </div>
        <ul class="log-list">${items || '<li class="log-empty">No foods yet.</li>'}</ul>
        <form class="log-inline plan-add" data-on-submit="planAddItem" data-args="${args('$event', i)}">
          <select class="machine-dropdown" aria-label="Food">${options}</select>
          <input type="number" class="input-field" min="0" step="any" placeholder="Amount" aria-label="Amount" />
          <button class="btn btn-secondary btn-sm" type="submit">Add</button>
        </form>
      </div>`;
    })
    .join('');

  const custom = Object.entries(getCustomFoods())
    .map(
      ([id, f]) => `
      <li class="log-entry">
        <span class="log-entry-name">${esc(f.name)} <span class="food-amount">${f.per} ${unitText(f)}</span></span>
        <span class="log-entry-kcal">${kcal(f.kcal)} kcal · P ${f.p}g C ${f.c}g F ${f.f}g</span>
        <button class="btn-xs" aria-label="Delete" data-on-click="removeCustomFood" data-args="${args(id)}">✕</button>
      </li>`
    )
    .join('');

  container.innerHTML = `
    <div class="nutri-plan-bar">
      <p class="nutri-plan-heading">Editing your ${draftMode} day plan · ≈ ${kcal(total.kcal)} kcal · ${Math.round(total.p)} g protein</p>
      <div class="nutri-plan-actions">
        <button class="btn btn-secondary btn-sm" data-on-click="cancelPlanEdit">Cancel</button>
        <button class="btn btn-primary btn-sm" data-on-click="savePlanEdit">Save plan</button>
      </div>
    </div>
    ${meals}
    <button class="btn btn-secondary" data-on-click="planAddMeal">+ Add meal</button>
    <div class="nutrition-card">
      <div class="analytics-header">Your foods</div>
      <ul class="log-list">${custom || '<li class="log-empty">Foods you add here can be used in your plan and your log.</li>'}</ul>
      <form class="custom-food-form" data-on-submit="addCustomFoodFromForm" data-args="${args('$event')}">
        <input name="name" class="input-field cf-name" placeholder="Name, e.g. Paneer" maxlength="60" aria-label="Name" />
        <label>Per <input name="per" type="number" class="input-field" min="0" step="any" value="100" /></label>
        <label>Unit <select name="unit" class="machine-dropdown">${UNITS.map(u => `<option>${u}</option>`).join('')}</select></label>
        <label>kcal <input name="kcal" type="number" class="input-field" min="0" step="any" /></label>
        <label>Protein g <input name="p" type="number" class="input-field" min="0" step="any" /></label>
        <label>Carbs g <input name="c" type="number" class="input-field" min="0" step="any" /></label>
        <label>Fat g <input name="f" type="number" class="input-field" min="0" step="any" /></label>
        <button class="btn btn-primary btn-sm" type="submit">Add food</button>
      </form>
    </div>`;
}
