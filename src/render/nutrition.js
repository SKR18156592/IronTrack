import { NUTRITION_PLANS } from '../data/nutrition.js';
import { esc, getL } from '../storage.js';

let currentDietMode = 'rest';
export function setDietMode(mode) {
  currentDietMode = mode;
  document.getElementById('dietRestBtn').classList.toggle('active', mode === 'rest');
  document.getElementById('dietWorkoutBtn').classList.toggle('active', mode === 'workout');
  renderNutritionPlan();
}

export function renderNutritionPlan() {
  const plan = NUTRITION_PLANS[currentDietMode];
  document.getElementById('dietCals').textContent = plan.cals + ' kcal';
  document.getElementById('dietProt').textContent = plan.prot + ' g';
  document.getElementById('dietCarbs').textContent = plan.carbs + ' g';
  document.getElementById('dietFat').textContent = plan.fat + ' g';

  const weight = parseFloat(getL('iron_profile_weight', '72.5'));
  const height = parseFloat(getL('iron_profile_height', '175'));
  const age = parseFloat(getL('iron_profile_age', '23'));
  const sex = getL('iron_profile_sex', 'male');

  if (weight > 0 && height > 0) {
    const heightM = height / 100;
    const bmi = weight / (heightM * heightM);
    document.getElementById('nutriBmiDisplay').textContent = `BMI: ${bmi.toFixed(1)} (${bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese'})`;
  }

  if (age > 0 && weight > 0 && height > 0) {
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += (sex === 'male') ? 5 : -161;
    const tdee = bmr * 1.55;
    document.getElementById('nutriTdeeDisplay').textContent = `Calculated Maintenance TDEE: ~${tdee.toFixed(0)} kcal/day (BMR: ${bmr.toFixed(0)})`;
  }

  const container = document.getElementById('nutritionMealsContainer');
  if (!container) return;
  
  container.innerHTML = plan.meals.map(meal => `
    <div class="meal-box">
      <div class="meal-header-row">
        <div class="meal-title">${esc(meal.title.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, ''))}</div>
        <div class="meal-badge-summary">${meal.summary}</div>
      </div>
      <div class="food-grid">
        ${meal.items.map(item => {
          const totalMacros = (item.p || 0) + (item.c || 0) + (item.f || 0) || 1;
          const pPct = Math.round(((item.p || 0) / totalMacros) * 100);
          const cPct = Math.round(((item.c || 0) / totalMacros) * 100);
          const fPct = Math.max(0, 100 - pPct - cPct);
          return `
            <div class="food-card">
              <div class="food-name">${item.name}</div>
              <div class="food-metrics-row">
                <span class="food-cals">${item.cals} kcal</span>
                <span>P:${item.p}g | C:${item.c}g | F:${item.f}g</span>
              </div>
              <div class="macro-bar-container" title="Protein / Carbs / Fat Distribution">
                <div class="macro-fill-p" style="width: ${pPct}%"></div>
                <div class="macro-fill-c" style="width: ${cPct}%"></div>
                <div class="macro-fill-f" style="width: ${fPct}%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}
