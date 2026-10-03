import { BODY_ART } from '../data/body-art.js';

// Anatomical front/back figure for the muscle recovery card, drawn from the body artwork in
// src/data/body-art.js. Each tracked muscle belongs to one of the app's muscle groups and is tinted by
// that group's status through CSS (data-status); everything else is drawn as the untinted body.

// Artwork part -> [muscle group, name]. The app counts trap exercises as shoulders.
export const PART_GROUP = {
  chest: ['chest', 'Chest'],
  'upper-back': ['back', 'Upper back'],
  'lower-back': ['back', 'Lower back'],
  deltoids: ['shoulders', 'Delts'],
  trapezius: ['shoulders', 'Traps'],
  biceps: ['arms', 'Biceps'],
  triceps: ['arms', 'Triceps'],
  forearm: ['arms', 'Forearms'],
  quadriceps: ['legs', 'Quads'],
  hamstring: ['legs', 'Hamstrings'],
  gluteal: ['legs', 'Glutes'],
  adductors: ['legs', 'Adductors'],
  calves: ['legs', 'Calves'],
  tibialis: ['legs', 'Shins']
};

// Parts the app doesn't track, drawn for shape only.
export const UNTRACKED_PARTS = new Set(['abs', 'obliques', 'head', 'hair', 'neck', 'hands', 'knees', 'ankles', 'feet']);

const paths = (list, attrs = '') => list.map(d => `<path d="${d}"${attrs}/>`).join('');

// view: 'front' or 'back'. statusByGroup: group -> { key, label }. groupLabel: group -> display name.
// body: 'male' or 'female'.
export function bodyFigure(view, statusByGroup, groupLabel, body = 'male') {
  const art = (BODY_ART[body] || BODY_ART.male)[view];
  const shapes = art.parts
    .map(({ slug, paths: list }) => {
      if (!PART_GROUP[slug]) return `<g class="body-part${slug === 'hair' ? ' body-hair' : ''}">${paths(list)}</g>`;
      const [group, name] = PART_GROUP[slug];
      const { key, label } = statusByGroup[group];
      return `<g class="muscle" data-status="${key}"><title>${name} (${groupLabel[group]}): ${label}</title>${paths(list)}</g>`;
    })
    .join('');
  const title = view === 'front' ? 'Front' : 'Back';
  return `<figure class="body-figure">
    <svg viewBox="${art.viewBox}" role="img" aria-label="${title} view, tinted by recovery">${shapes}</svg>
    <figcaption>${title}</figcaption>
  </figure>`;
}
