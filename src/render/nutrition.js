import { FOODS } from '../data/foods.js';
import { NUTRITION_PLANS } from '../data/nutrition.js';
import { getMicrocycle } from '../model.js';
import {
  ACTIVITY_LEVELS,
  GOALS,
  bmi,
  bmr,
  dailyTargets,
  foodNutrients,
  hasBodyMetrics,
  isWorkoutDay,
  mealNutrients,
  planNutrients,
  readProfile,
  scalePlan,
  workoutDaysPerWeek
} from '../nutrition-targets.js';
import { args } from '../actions.js';
import { esc, setL } from '../storage.js';
import { pushToCloud } from '../sync.js';
import { renderNutritionLog } from './nutrition-log.js';

// null: follow today's schedule. Set when the user picks a plan, until the app restarts.
let chosenDietMode = null;
let shownMeals = []; // the plan as last rendered, for logging a meal from it

export const plannedMeals = () => shownMeals;

export function setDietMode(mode) {
  chosenDietMode = mode;
  renderNutritionPlan();
}

export function setNutritionGoal(goal) {
  if (!GOALS[goal]) return;
  setL('iron_nutrition_goal', goal);
  setL('iron_nutrition_rate', String(GOALS[goal].defaultRate));
  pushToCloud();
  renderNutritionPlan();
}

export function setNutritionRate(rate) {
  setL('iron_nutrition_rate', rate);
  pushToCloud();
  renderNutritionPlan();
}

export function setActivityLevel(activity) {
  if (!ACTIVITY_LEVELS.some(a => a.value === activity)) return;
  setL('iron_profile_activity', activity);
  pushToCloud();
  renderNutritionPlan();
}

const round1 = v => Math.round(v * 10) / 10;
const kcal = v => Math.round(v).toLocaleString('en-US');
const unitLabel = food => (food.unit === 'piece' ? '' : ' ' + food.unit);
const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + kcal(Math.abs(v));

function renderControls(profile) {
  const goal = document.getElementById('nutriGoal');
  const rate = document.getElementById('nutriRate');
  const activity = document.getElementById('nutriActivity');
  if (!goal || !rate || !activity) return;
  goal.innerHTML = Object.entries(GOALS)
    .map(([k, g]) => `<option value="${k}"${k === profile.goal ? ' selected' : ''}>${g.label}</option>`)
    .join('');
  const rates = GOALS[profile.goal].rates;
  rate.innerHTML = rates
    .map(r => `<option value="${r}"${r === profile.rate ? ' selected' : ''}>${r} kg / week</option>`)
    .join('');
  rate.closest('.meta-field').hidden = rates.length < 2;
  activity.innerHTML = ACTIVITY_LEVELS.map(
    a => `<option value="${a.value}"${Number(a.value) === profile.activity ? ' selected' : ''}>${a.label}</option>`
  ).join('');
}

function renderTiles({ kcal: k, protein, carbs, fat }) {
  document.getElementById('dietCals').textContent = `${kcal(k)} kcal`;
  document.getElementById('dietProt').textContent = `${Math.round(protein)} g`;
  document.getElementById('dietCarbs').textContent = `${Math.round(carbs)} g`;
  document.getElementById('dietFat').textContent = `${Math.round(fat)} g`;
}

function renderMeals(meals, heading) {
  const container = document.getElementById('nutritionMealsContainer');
  if (!container) return;
  shownMeals = meals;
  const total = planNutrients(meals, FOODS);
  container.innerHTML =
    `<p class="nutri-plan-heading">${heading} · ≈ ${kcal(total.kcal)} kcal · ${Math.round(total.p)} g protein</p>` +
    meals
      .map((meal, index) => {
        const sum = mealNutrients(meal, FOODS);
        const cards = meal.items
          .map(([id, amount]) => {
            const food = FOODS[id];
            const n = foodNutrients(food, amount);
            const macroKcal = n.p * 4 + n.c * 4 + n.f * 9 || 1;
            const pPct = Math.round(((n.p * 4) / macroKcal) * 100);
            const cPct = Math.round(((n.c * 4) / macroKcal) * 100);
            return `
            <div class="food-card">
              <div class="food-name">${esc(food.name)} <span class="food-amount">${amount}${unitLabel(food)}</span></div>
              <div class="food-metrics-row">
                <span class="food-cals">${kcal(n.kcal)} kcal</span>
                <span>P:${round1(n.p)}g | C:${round1(n.c)}g | F:${round1(n.f)}g</span>
              </div>
              <div class="macro-bar-container" title="Calories from protein / carbs / fat">
                <div class="macro-fill-p" style="width: ${pPct}%"></div>
                <div class="macro-fill-c" style="width: ${cPct}%"></div>
                <div class="macro-fill-f" style="width: ${Math.max(0, 100 - pPct - cPct)}%"></div>
              </div>
            </div>`;
          })
          .join('');
        return `
        <div class="meal-box">
          <div class="meal-header-row">
            <div class="meal-title">${esc(meal.title)}</div>
            <div class="meal-badge-summary">${kcal(sum.kcal)} kcal • ${round1(sum.p)}g Protein</div>
            <button class="btn btn-secondary btn-sm" data-on-click="logPlannedMeal" data-args="${args(index)}">Log this meal</button>
          </div>
          <div class="food-grid">${cards}</div>
        </div>`;
      })
      .join('');
}

export function renderNutritionPlan() {
  renderNutritionLog();
  const microcycle = getMicrocycle();
  const todayType = isWorkoutDay(microcycle) ? 'workout' : 'rest';
  const mode = chosenDietMode || todayType;
  const restBtn = document.getElementById('dietRestBtn');
  if (!restBtn) return;
  restBtn.classList.toggle('active', mode === 'rest');
  document.getElementById('dietWorkoutBtn').classList.toggle('active', mode === 'workout');
  restBtn.querySelector('.today-tag').hidden = todayType !== 'rest';
  document.getElementById('dietWorkoutBtn').querySelector('.today-tag').hidden = todayType !== 'workout';

  const profile = readProfile();
  renderControls(profile);
  const plan = NUTRITION_PLANS[mode];
  const summary = document.getElementById('nutritionProfileSummaryBox');

  if (!hasBodyMetrics(profile)) {
    const example = planNutrients(plan.meals, FOODS);
    renderTiles({ kcal: example.kcal, protein: example.p, carbs: example.c, fat: example.f });
    summary.innerHTML = `<span class="nutri-warning">Add your age, weight and height to get targets made for you.
      Until then, these are the example plan's numbers.</span>
      <button class="btn btn-secondary btn-sm" data-on-click="showTab" data-args='["settings"]'>Open profile</button>`;
    renderMeals(plan.meals, 'Example plan');
    return;
  }

  const target = dailyTargets(profile, mode, workoutDaysPerWeek(microcycle));
  renderTiles(target);
  const b = bmi(profile);
  const goal = GOALS[profile.goal];
  const goalLine =
    profile.goal === 'maintain'
      ? 'Goal: maintain your weight'
      : `Goal: ${goal.label.toLowerCase()}, ${profile.rate} kg / week`;
  summary.innerHTML = `
    <span class="nutri-accent">BMI ${b.value.toFixed(1)} (${b.category}) · BMR ${kcal(bmr(profile))} kcal · Maintenance ${kcal(target.maintenance)} kcal</span>
    <span>${goalLine}. This ${mode} day: ${signed(target.kcal - target.maintenance)} kcal from maintenance,
      protein at ${goal.proteinPerKg} g per kg of body weight.</span>
    ${target.floored ? '<span class="nutri-warning">Raised to your BMR: eating less than that is not recommended. Try a slower rate.</span>' : ''}`;
  renderMeals(
    scalePlan(plan.meals, FOODS, { kcal: target.kcal, protein: target.protein }),
    'Example plan for your targets'
  );
}
