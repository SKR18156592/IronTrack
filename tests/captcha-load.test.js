// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';

// The bot check is on, but Turnstile's script can't be loaded (offline, or blocked by an extension).
vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
const { captchaFailure, captchaReady, renderCaptcha } = await import('../src/captcha.js');

it('reports a script that does not load', async () => {
  vi.spyOn(document.head, 'appendChild').mockImplementation(script => {
    setTimeout(() => script.onerror());
    return script;
  });
  const failed = vi.fn();
  await renderCaptcha(document.createElement('div'), { failed });
  expect(failed).toHaveBeenCalledWith('load');
  expect(captchaFailure()).toBe('load');
  expect(captchaReady()).toBe(false);
});
