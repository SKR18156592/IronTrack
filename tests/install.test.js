// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../src/ui.js', () => ({ showToast: vi.fn() }));

const card = () => document.getElementById('installCard');
const button = () => document.getElementById('installButton');
const steps = () => document.getElementById('installIosSteps');

function promptEvent(outcome) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = vi.fn();
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = `
    <div id="installCard" hidden>
      <button id="installButton" hidden></button>
      <p id="installIosSteps" hidden></p>
    </div>`;
});

it('stays hidden when the browser offers no install', async () => {
  const { initInstall } = await import('../src/install.js');
  initInstall();
  expect(card().hidden).toBe(true);
});

it('shows the button once the browser fires beforeinstallprompt, and prompts on click', async () => {
  const { installApp } = await import('../src/install.js');
  const event = promptEvent('accepted');
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(card().hidden).toBe(false);
  expect(button().hidden).toBe(false);
  expect(steps().hidden).toBe(true);
  await installApp();
  expect(event.prompt).toHaveBeenCalledOnce();
});

it('hides the card when the prompt is dismissed or the app is installed', async () => {
  const { installApp } = await import('../src/install.js');
  window.dispatchEvent(promptEvent('dismissed'));
  await installApp();
  expect(card().hidden).toBe(true);
  window.dispatchEvent(promptEvent('accepted'));
  window.dispatchEvent(new Event('appinstalled'));
  expect(card().hidden).toBe(true);
});

it('shows the Add to Home Screen steps on iPhone', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
  const { initInstall } = await import('../src/install.js');
  initInstall();
  expect(card().hidden).toBe(false);
  expect(steps().hidden).toBe(false);
  expect(button().hidden).toBe(true);
  vi.restoreAllMocks();
});
