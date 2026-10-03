import { describe, expect, it } from 'vitest';
import { BODY_ART } from '../src/data/body-art.js';
import { PART_GROUP, UNTRACKED_PARTS, bodyFigure } from '../src/render/body-figure.js';
import { MUSCLE_GROUP_ORDER } from '../src/model.js';

const status = Object.fromEntries(MUSCLE_GROUP_ORDER.map(g => [g, { key: 'fresh', label: 'Fresh' }]));
const labels = Object.fromEntries(MUSCLE_GROUP_ORDER.map(g => [g, g]));

describe('bodyFigure', () => {
  it('knows every part of the artwork, so none is silently left untinted', () => {
    for (const body of Object.values(BODY_ART)) {
      for (const { parts } of Object.values(body)) {
        for (const { slug } of parts) expect(PART_GROUP[slug] || UNTRACKED_PARTS.has(slug), slug).toBeTruthy();
      }
    }
  });

  it('shows every muscle group on one of the two views', () => {
    for (const body of ['male', 'female']) {
      const svg = bodyFigure('front', status, labels, body) + bodyFigure('back', status, labels, body);
      for (const g of MUSCLE_GROUP_ORDER) expect(svg, `${body} ${g}`).toContain(`(${g}): Fresh`);
    }
  });
});
