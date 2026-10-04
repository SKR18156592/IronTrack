import { args } from '../actions.js';
import { getHistory } from '../history-store.js';
import { buildPerformanceIndex, compareSet, formatSet, lastPerformance, suggestNext } from '../performance.js';
import { esc } from '../storage.js';

// ---- Last time's numbers and set feedback.
let perfIndex = new Map(); // past performance per exercise + equipment, from history

// Call before rendering the cards, so they show the latest history.
export function refreshPerformanceIndex() {
  perfIndex = buildPerformanceIndex(getHistory());
}

function cardPerformance(card) {
  const variation = card.querySelector('.machine-dropdown')?.value || '';
  return lastPerformance(perfIndex, card.dataset.category, variation);
}

const fmtKg = w => `${+w.toFixed(2)} kg`;

// The suggestion for this session from last time on the same equipment (see suggestNext).
function updateSuggestion(card, entry) {
  const box = card.querySelector('.ex-suggest');
  if (!box) return;
  const next = suggestNext(entry, card.dataset.scheme);
  box.hidden = !next;
  if (!next) return;
  const arrow = { up: '↑', down: '↓', reps: '→', hold: '→' }[next.kind];
  const target = next.weight > 0 ? `${fmtKg(next.weight)} × ${next.reps}` : `Bodyweight × ${next.reps}`;
  box.dataset.kind = next.kind;
  box.innerHTML = `<span class="ex-suggest-text"><strong>${arrow} Today: ${esc(target)}</strong>
      <span class="ex-suggest-why">${esc(next.why)}</span></span>
    ${next.weight > 0 ? `<button type="button" class="btn-xs" data-on-click="useSuggestion" data-args="${args('$el', next.weight)}">Use</button>` : ''}`;
}

// Puts the suggested weight in this exercise's working sets that aren't done yet.
export function useSuggestion(btn, weight) {
  const card = btn.closest('.exercise-card');
  card.querySelectorAll('tbody tr').forEach(tr => {
    const tag = tr.querySelector('.set-tag')?.value;
    if (tr.querySelector('.check-btn')?.classList.contains('completed') || tag === 'Warmup' || tag === 'Drop Set')
      return;
    const input = tr.querySelector('.set-weight');
    if (input) input.value = weight;
  });
  // The tap itself saves the in-progress session (session-draft.js listens for clicks).
}

// Shows what each set was last time on the same equipment, and what to aim for today.
export function updateLastHints(card) {
  const entry = cardPerformance(card);
  updateSuggestion(card, entry);
  card.querySelectorAll('tbody tr').forEach((tr, i) => {
    const text = tr.querySelector('.set-last-text');
    const last = entry && entry.sets[i];
    if (text) text.textContent = last ? `Last: ${formatSet(last)}` : '';
    showSetBadge(tr, entry);
  });
}

// 'PR' or '↑' next to a finished set that beats the best ever or last time.
export function showSetBadge(tr, entry) {
  const badge = tr && tr.querySelector('.set-badge');
  if (!badge) return;
  const card = tr.closest('.exercise-card');
  const done = tr.querySelector('.check-btn')?.classList.contains('completed');
  const index = [...tr.parentElement.children].indexOf(tr);
  const result =
    done && card
      ? compareSet(
          entry === undefined ? cardPerformance(card) : entry,
          index,
          tr.querySelector('.set-weight')?.value,
          tr.querySelector('.set-reps')?.value
        )
      : null;
  badge.textContent = result === 'pr' ? 'PR' : result === 'up' ? '↑ Beat last time' : '';
  badge.dataset.kind = result || '';
  return result;
}
