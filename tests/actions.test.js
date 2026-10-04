// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const { args, hasAction, listenForActions, registerActions } = await import('../src/actions.js');

// Every file whose markup can name an action.
const root = join(import.meta.dirname, '..');
const sources = [
  join(root, 'index.html'),
  ...readdirSync(join(root, 'src'), { recursive: true })
    .filter(f => /\.(js|html)$/.test(f) && f !== 'actions.js') // html: src/partials/
    .map(f => join(root, 'src', f))
]; // actions.js: only examples
const markup = sources.map(f => [f, readFileSync(f, 'utf8')]);

describe('actions in the markup', () => {
  it('are all exported by a registered module', async () => {
    // The same modules src/main.js registers.
    const mods = await Promise.all([
      import('../src/ui.js'),
      import('../src/sync.js'),
      import('../src/render/analytics.js'),
      import('../src/render/exercises.js'),
      import('../src/render/history.js'),
      import('../src/render/nutrition.js'),
      import('../src/render/nutrition-log.js'),
      import('../src/render/meal-plan-editor.js'),
      import('../src/render/nutrition-insights.js'),
      import('../src/render/onboarding.js'),
      import('../src/render/profile.js'),
      import('../src/render/schedule.js'),
      import('../src/render/share-card.js'),
      import('../src/render/tools.js'),
      import('../src/render/workout.js'),
      import('../src/render/set-rows.js'),
      import('../src/render/timers.js'),
      import('../src/render/exercise-hints.js'),
      import('../src/render/exercise-focus.js')
    ]);
    registerActions(mods);
    const names = new Set(markup.flatMap(([, text]) => [...text.matchAll(/data-on-[a-z-]+="(\w+)"/g)].map(m => m[1])));
    expect(names.size).toBeGreaterThan(50);
    expect([...names].filter(n => !hasAction(n))).toEqual([]);
  });

  it('use no inline on* handlers', () => {
    const inline = markup
      .filter(([, text]) => /<[^>]*\son(click|change|input|submit|keydown|focus|blur)\s*=/i.test(text))
      .map(([f]) => f);
    expect(inline).toEqual([]);
  });
});

describe('dispatch', () => {
  const calls = [];
  registerActions([
    {
      testRecord: (...a) => calls.push(a),
      testClose: () => calls.push(['close'])
    }
  ]);
  listenForActions();

  it('passes the arguments, element and value, innermost element first', () => {
    document.body.innerHTML = `<div data-on-click="testRecord" data-args="${args('outer')}">
      <button data-on-click="testRecord" data-args="${args('a"b', 2, '$el', true)}">x</button></div>
      <input data-on-input="testRecord" data-args="${args('$value')}" value="42">`;
    calls.length = 0;
    const btn = document.querySelector('button');
    btn.click();
    expect(calls).toEqual([['a"b', 2, btn, true], ['outer']]);
    calls.length = 0;
    document.querySelector('input').dispatchEvent(new Event('input', { bubbles: true }));
    expect(calls).toEqual([['42']]);
  });

  it('runs a self-click handler only for clicks on the element itself', () => {
    document.body.innerHTML = `<div id="overlay" data-on-self-click="testClose"><button>inside</button></div>`;
    calls.length = 0;
    document.querySelector('button').click();
    expect(calls).toEqual([]);
    document.getElementById('overlay').click();
    expect(calls).toEqual([['close']]);
  });

  it('refuses two different functions under one name', () => {
    expect(() => registerActions([{ testClose: () => {} }])).toThrow(/testClose/);
  });
});
