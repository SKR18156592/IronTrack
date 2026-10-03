import { esc } from './storage.js';

// Event handlers in the markup and rendered templates are data attributes naming an exported function,
// so nothing has to be global and no JavaScript is built from strings:
//   data-on-click="fn"                         calls fn()
//   data-on-click="fn" data-args='["a", 1]'    calls fn('a', 1)
// In data-args, "$el" stands for the element, "$value" for its value and "$event" for the event.
// Templates build data-args with args(). A data-on-self-click handler runs only when the click
// lands on the element itself, not inside it (closing a modal from its backdrop).
// Like inline handlers, every element from the target up runs its handler, innermost first.

const EVENTS = ['click', 'change', 'input', 'submit', 'keydown', 'focusin'];
const registry = new Map();

export function args(...list) {
  return esc(JSON.stringify(list));
}

// Makes every exported function of these modules available as an action.
export function registerActions(modules) {
  for (const mod of modules) {
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn !== 'function') continue;
      if (registry.has(name) && registry.get(name) !== fn)
        throw new Error(`Two modules export a function named ${name}`);
      registry.set(name, fn);
    }
  }
}

export function hasAction(name) {
  return registry.has(name);
}

function run(el, name, event) {
  const fn = registry.get(name);
  if (!fn) {
    console.error(`No action named ${name}`);
    return;
  }
  const list = el.dataset.args ? JSON.parse(el.dataset.args) : [];
  fn(...list.map(a => (a === '$el' ? el : a === '$value' ? el.value : a === '$event' ? event : a)));
}

function dispatch(event) {
  const attr = 'data-on-' + event.type;
  for (let el = event.target; el instanceof Element; el = el.parentElement) {
    const name = el.getAttribute(attr);
    if (name) run(el, name, event);
    if (event.type === 'click' && el === event.target && el.hasAttribute('data-on-self-click')) {
      run(el, el.getAttribute('data-on-self-click'), event);
    }
  }
}

export function listenForActions(root = document) {
  EVENTS.forEach(type => root.addEventListener(type, dispatch));
}
