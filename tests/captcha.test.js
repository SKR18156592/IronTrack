// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The bot check on: a site key at build time, and Turnstile already loaded on the page.
vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
vi.mock('../src/ui.js', async importOriginal => ({ ...(await importOriginal()), showToast: vi.fn() }));

let onToken, onError;
window.turnstile = {
  render: vi.fn((el, opts) => {
    onToken = opts.callback;
    onError = opts['error-callback'];
    return 'widget-1';
  }),
  reset: vi.fn()
};

const captcha = await import('../src/captcha.js');
const { handleAuthSubmit, openSignIn, requestPasswordReset, setSyncContext } = await import('../src/sync.js');

const auth = {
  signInWithPassword: vi.fn(async () => ({
    data: { user: null, session: null },
    error: { message: 'Invalid login credentials' }
  })),
  resetPasswordForEmail: vi.fn(async () => ({ error: null }))
};
const el = id => document.getElementById(id);

beforeEach(async () => {
  vi.clearAllMocks();
  document.body.innerHTML = `
    <div id="authOverlay" class="active"><div id="authCaptcha"></div>
      <input type="email" id="authEmail" value="sam@gmail.com" /><input id="authPassword" value="secret123" />
      <button id="authForgotBtn"></button><button id="authSubmitBtn"></button>
      <div id="authMsg"></div><button id="authFixEmailBtn" hidden></button><button id="authResendBtn" hidden></button>
    </div>`;
  setSyncContext({ client: { auth }, user: null });
  await captcha.renderCaptcha(el('authCaptcha'));
});

describe('the bot check', () => {
  it('is shown once on the sign-in form', () => {
    expect(captcha.captchaEnabled()).toBe(true);
    expect(window.turnstile.render).toHaveBeenCalledTimes(1);
    expect(window.turnstile.render.mock.calls[0][1]).toMatchObject({ sitekey: 'test-site-key', theme: 'dark' });
  });

  it('must be passed before signing in', async () => {
    await handleAuthSubmit({ preventDefault() {} });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(el('authMsg').textContent).toBe('Complete the security check above first.');
  });

  it('sends its token with the request, then asks for a fresh one', async () => {
    onToken('token-abc');
    await handleAuthSubmit({ preventDefault() {} });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'sam@gmail.com',
      password: 'secret123',
      options: { captchaToken: 'token-abc' }
    });
    expect(window.turnstile.reset).toHaveBeenCalledWith('widget-1');
    expect(captcha.captchaReady()).toBe(false); // a token works once
  });

  it('is required for password reset emails too', async () => {
    await requestPasswordReset();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
    onToken('token-xyz');
    await requestPasswordReset();
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('sam@gmail.com', {
      redirectTo: location.origin + location.pathname,
      captchaToken: 'token-xyz'
    });
  });

  it('says when it could not load, right away and on submit', async () => {
    openSignIn(); // registers the failure handler, as opening the sign-in form does
    expect(onError('110200')).toBe(true);
    expect(el('authMsg').style.display).toBe('block');
    expect(el('authMsg').textContent).toMatch(/couldn't load \(error 110200\).*reload the page/);
    el('authMsg').style.display = 'none';
    await handleAuthSubmit({ preventDefault() {} });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(el('authMsg').textContent).toMatch(/couldn't load \(error 110200\)/);
  });

  it('clears the failure once a retry succeeds', async () => {
    openSignIn();
    onError('300030');
    expect(captcha.captchaFailure()).toBe('300030');
    onToken('token-ok');
    expect(captcha.captchaFailure()).toBe('');
    expect(el('authMsg').style.display).toBe('none');
    expect(captcha.captchaReady()).toBe(true);
  });
});
