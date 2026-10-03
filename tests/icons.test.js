import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES, icon } from '../src/icons.js';

const root = join(import.meta.dirname, '..');
const sources = [
  join(root, 'index.html'),
  ...readdirSync(join(root, 'src'), { recursive: true })
    .filter(f => f.endsWith('.js'))
    .map(f => join(root, 'src', f))
];

describe('icons', () => {
  it('every icon referenced in markup and templates exists', () => {
    const used = new Set();
    for (const file of sources) {
      const code = readFileSync(file, 'utf8');
      for (const m of code.matchAll(/data-icon="([^"]+)"/g)) used.add(m[1]);
      for (const m of code.matchAll(/icon\('([^']+)'/g)) used.add(m[1]);
    }
    used.delete('name'); // the example in icons.js's own comment
    expect(used.size).toBeGreaterThan(20);
    expect([...used].filter(n => !ICON_NAMES.includes(n))).toEqual([]);
  });

  it('renders an inline, theme-coloured, decorative svg', () => {
    const svg = icon('check', { size: 20, className: 'x' });
    expect(svg).toMatch(/^<svg class="icon x" width="20" height="20"/);
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('aria-hidden="true"');
  });
});
