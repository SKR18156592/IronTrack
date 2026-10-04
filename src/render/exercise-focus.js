import { WORKOUT, getLinkedCategory } from '../model.js';

// ---- One exercise open at a time (plus its superset partner), so the day isn't one long scroll.
let openCards = {}; // day -> category of the exercise the user is on

// A re-render mid-workout keeps the exercise the user is on: save before, restore after.
export const saveOpenExercises = () => ({ ...openCards });
export function restoreOpenExercises(saved) {
  openCards = saved;
}
// Restored set values decide which exercise is next: open the first unfinished one.
export function forgetOpenExercises() {
  openCards = {};
}

function dayCards(day) {
  return [...document.querySelectorAll(`#view-day-${day} .exercise-card`)];
}

// Each card's 'done/total' label and its done state.
export function updateCardProgress(day) {
  dayCards(day).forEach(card => {
    const rows = card.querySelectorAll('tbody tr').length;
    const done = card.querySelectorAll('.check-btn.completed').length;
    const label = card.querySelector('.ex-progress');
    if (label) label.textContent = `${done}/${rows}`;
    card.classList.toggle('done', rows > 0 && done === rows);
  });
}

// Opens `category` (or, if it's not on this day, the first unfinished exercise) and collapses the rest.
export function focusExercise(day, category, scroll = false) {
  const cards = dayCards(day);
  const target =
    cards.find(c => c.dataset.category === category) || cards.find(c => !c.classList.contains('done')) || null;
  const partner = target ? getLinkedCategory(target.dataset.category) : null;
  cards.forEach(card => {
    const open = card === target || (partner && card.dataset.category === partner);
    card.classList.toggle('collapsed', !open);
    card.classList.toggle('highlight', open);
    card.querySelector('.ex-header')?.setAttribute('aria-expanded', String(open));
  });
  openCards[day] = target ? target.dataset.category : null;
  if (scroll && target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function refreshExerciseFocus() {
  Object.keys(WORKOUT).forEach(day => {
    updateCardProgress(day);
    focusExercise(day, openCards[day]);
  });
}

export function onExerciseHeaderKey(header, event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  toggleExerciseCard(header);
}

export function toggleExerciseCard(header) {
  if (document.body.classList.contains('edit-mode')) return; // everything stays open while editing
  const card = header.closest('.exercise-card');
  const day = card.closest('.day-view').id.replace('view-day-', '');
  if (card.classList.contains('collapsed')) {
    focusExercise(day, card.dataset.category);
  } else {
    card.classList.add('collapsed');
    card.classList.remove('highlight');
    header.setAttribute('aria-expanded', 'false');
    openCards[day] = null;
  }
}

// After an exercise's last set: open the next unfinished one (wrapping around), or none if all are done.
export function advanceFrom(card) {
  if (!card.classList.contains('done') || card.classList.contains('collapsed')) return;
  const day = card.closest('.day-view').id.replace('view-day-', '');
  const cards = dayCards(day);
  const i = cards.indexOf(card);
  const next = [...cards.slice(i + 1), ...cards.slice(0, i)].find(c => !c.classList.contains('done'));
  if (next) focusExercise(day, next.dataset.category, true);
  else focusExercise(day, null);
}
