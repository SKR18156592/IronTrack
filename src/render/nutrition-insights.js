import { args } from '../actions.js';
import { formatTick, niceTicks } from '../chart-scale.js';
import { getHistory } from '../history-store.js';
import { getNutritionLog, localDate, shiftDate, weightSeries } from '../nutrition-log.js';
import { goalRate, movingAverage, suggestAdjustment, weekSummary, weeklyRate } from '../nutrition-insights.js';
import { hasBodyMetrics, readProfile } from '../nutrition-targets.js';
import { getL, setL } from '../storage.js';
import { pushToCloud } from '../sync.js';
import { showToast } from '../ui.js';
import { renderNutritionPlan } from './nutrition.js';

// The Progress card on the Nutrition tab: body-weight trend against the goal, a calorie adjustment
// when they disagree, and the last 7 days of eating and training.

// A change needs about two weeks to show in the weight trend, so no new suggestion until then.
const SETTLE_DAYS = 14;
const ADJUSTED_AT_KEY = 'iron_nutrition_adjusted_at';

export function applyCalorieAdjustment(kcal) {
  const current = readProfile().adjust;
  setL('iron_nutrition_adjust', String(current + Number(kcal)));
  setL(ADJUSTED_AT_KEY, localDate());
  pushToCloud();
  showToast('✅ Daily calories adjusted', 'success');
  renderNutritionPlan();
}

export function resetCalorieAdjustment() {
  setL('iron_nutrition_adjust', '0');
  setL(ADJUSTED_AT_KEY, '');
  pushToCloud();
  renderNutritionPlan();
}

export function setTrainingTime(time) {
  setL('iron_training_time', /^\d{2}:\d{2}$/.test(time) ? time : '');
  pushToCloud();
  renderNutritionPlan();
}

const fmtKg = v => `${v.toFixed(1)} kg`;
const signedKg = v => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(2)} kg`;
const shortDate = date => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const dayIndex = date => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

// Weigh-ins as dots, the 7-day average as a line, dates to scale on x.
function weightChart(series, average) {
  const w = 520,
    h = 200,
    padL = 44,
    padR = 16,
    padT = 16,
    padB = 30;
  const chartW = w - padL - padR,
    chartH = h - padT - padB;
  const kgs = series.map(p => p.kg);
  const ticks = niceTicks(Math.min(...kgs), Math.max(...kgs), 3);
  const lo = ticks[0],
    hi = ticks.at(-1);
  const d0 = dayIndex(series[0].date),
    d1 = Math.max(d0 + 1, dayIndex(series.at(-1).date));
  const x = date => padL + ((dayIndex(date) - d0) / (d1 - d0)) * chartW;
  const y = kg => padT + chartH - ((kg - lo) / (hi - lo)) * chartH;

  let svg = `<svg class="plate-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Body weight over time" xmlns="http://www.w3.org/2000/svg">`;
  ticks.forEach(t => {
    svg += `<line x1="${padL}" y1="${y(t)}" x2="${w - padR}" y2="${y(t)}" class="chart-grid" />`;
    svg += `<text x="${padL - 8}" y="${y(t) + 4}" text-anchor="end" class="chart-label">${formatTick(t)}</text>`;
  });
  series.forEach(p => {
    svg += `<g class="weight-point"><title>${shortDate(p.date)}: ${fmtKg(p.kg)}</title>
      <circle cx="${x(p.date)}" cy="${y(p.kg)}" r="12" fill="transparent" />
      <circle cx="${x(p.date)}" cy="${y(p.kg)}" r="4" class="weight-dot" /></g>`;
  });
  if (average.length > 1) {
    svg += `<polyline points="${average.map(p => `${x(p.date)},${y(p.kg)}`).join(' ')}" class="chart-line" stroke="var(--accent)" fill="none" pointer-events="none" />`;
  }
  [series[0], series.at(-1)].forEach((p, i) => {
    svg += `<text x="${x(p.date)}" y="${h - 8}" text-anchor="${i ? 'end' : 'start'}" class="chart-label">${shortDate(p.date)}</text>`;
  });
  return svg + '</svg>';
}

export function renderNutritionInsights() {
  const card = document.getElementById('nutriProgressCard');
  if (!card) return;
  const today = localDate();
  const log = getNutritionLog();
  const profile = readProfile();
  const series = weightSeries(log).filter(p => p.date <= today);
  const week = weekSummary(log, getHistory(), today, profile.weight);
  const adjustedAt = getL(ADJUSTED_AT_KEY, '');
  const settling = !!adjustedAt && adjustedAt > shiftDate(today, -SETTLE_DAYS);

  let trend;
  if (!series.length) {
    trend = '<p class="chart-empty">Log your body weight in the food log to see your trend here.</p>';
  } else {
    const latest = series.at(-1);
    const rate = weeklyRate(series, today);
    const goal = goalRate(profile);
    const rateText =
      rate === null
        ? 'Log your weight a few times a week for 2 weeks to see your rate'
        : `${signedKg(rate)} / week · goal ${profile.goal === 'maintain' ? 'steady' : signedKg(goal) + ' / week'}`;
    trend = `<div class="trend-summary"><span class="trend-latest">${fmtKg(latest.kg)}</span><span class="trend-delta">${rateText}</span></div>`;
    if (series.length > 1) {
      trend += `<div class="svg-chart-wrap">${weightChart(series, movingAverage(series))}</div>
        <div class="chart-legend"><span class="legend-dot"></span> Weigh-in <span class="legend-line"></span> 7-day average</div>`;
    }
    const kcal = hasBodyMetrics(profile) && !settling ? suggestAdjustment(profile, rate) : null;
    if (kcal) {
      const direction = kcal > 0 ? 'more' : 'less';
      const pace = {
        lose:
          kcal < 0
            ? 'You’re losing more slowly than your goal'
            : 'You’re losing faster than your goal, which can cost muscle',
        gain:
          kcal > 0
            ? 'You’re gaining more slowly than your goal'
            : 'You’re gaining faster than your goal, which adds mostly fat',
        maintain: `Your weight is drifting ${kcal < 0 ? 'up' : 'down'}`
      }[profile.goal];
      trend += `<div class="nutri-suggestion">
        <span>${pace}. Try about <strong>${Math.abs(kcal)} kcal ${direction}</strong> per day.</span>
        <button class="btn btn-primary btn-sm" data-on-click="applyCalorieAdjustment" data-args="${args(kcal)}">Apply</button>
      </div>`;
    }
  }
  const adjust = profile.adjust
    ? `<p class="nutri-adjust">Your targets include a ${profile.adjust > 0 ? '+' : '−'}${Math.abs(profile.adjust)} kcal/day adjustment.${
        settling ? ' Give it two weeks of weigh-ins before changing it again.' : ''
      }
        <button class="btn-xs" data-on-click="resetCalorieAdjustment">Remove</button></p>`
    : '';
  const weekText = week.loggedDays
    ? `${Math.round(week.kcal).toLocaleString('en-US')} kcal and ${Math.round(week.protein)} g protein a day on average
       (${week.loggedDays} day${week.loggedDays === 1 ? '' : 's'} logged${week.proteinPerKg ? `, ${week.proteinPerKg.toFixed(1)} g protein per kg` : ''})`
    : 'No food logged';
  card.innerHTML = `
    <div class="analytics-header">Progress</div>
    ${trend}
    ${adjust}
    <p class="nutri-week"><strong>Last 7 days:</strong> ${weekText} · ${week.workouts} workout${week.workouts === 1 ? '' : 's'}.</p>`;
}
