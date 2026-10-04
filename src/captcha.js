// Cloudflare Turnstile on the sign-in form, so bots can't mass-create accounts (each one sends an email).
// Off unless VITE_TURNSTILE_SITE_KEY is set at build time. When Supabase's CAPTCHA protection is on, every
// sign-up, sign-in, password reset and resend must carry a token, so set the key and deploy before
// turning that on.

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let loading = null;
let widgetId = null;
let token = '';
let failure = ''; // why the check isn't working: a Turnstile error code, or 'load' if its script didn't load
let onFailure = () => {};

export const captchaEnabled = () => !!SITE_KEY;

function loadScript() {
  return (loading ||= new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null; // try again next time (offline)
      reject(new Error('Could not load the security check'));
    };
    document.head.appendChild(script);
  }));
}

function fail(reason) {
  token = '';
  failure = reason;
  onFailure(reason);
}

// Shows the check in `container` (once). Resolves when it's on screen; never rejects. failed(reason) runs
// when the check can't be completed (see captchaFailure), and failed('') if it works again after that.
export async function renderCaptcha(container, { failed = () => {} } = {}) {
  if (!SITE_KEY || !container) return;
  onFailure = failed;
  if (widgetId !== null) return;
  try {
    await loadScript();
  } catch (e) {
    console.warn(e);
    return fail('load');
  }
  widgetId = window.turnstile.render(container, {
    sitekey: SITE_KEY,
    theme: 'dark',
    size: 'flexible',
    callback: t => {
      token = t;
      if (!failure) return;
      failure = '';
      onFailure('');
    },
    'expired-callback': () => (token = ''),
    // With retries on (the default), Turnstile tries again; a later success clears the failure.
    'error-callback': code => {
      fail(String(code || 'unknown'));
      return true; // handled: no uncaught error in the console
    }
  });
}

// '' while the check works; otherwise a Turnstile error code, or 'load' when its script couldn't be loaded.
export const captchaFailure = () => failure;

// The current token, or undefined (no check configured, or not passed yet).
export const captchaToken = () => token || undefined;

// Whether the next auth request can go ahead: no check configured, or it has been passed.
export const captchaReady = () => !SITE_KEY || !!token;

// A token works once: get a fresh one after each request.
export function resetCaptcha() {
  token = '';
  if (widgetId !== null) window.turnstile?.reset(widgetId);
}

// Adds the token to Supabase auth options when there is one.
export function withCaptcha(options = {}) {
  const t = captchaToken();
  return t ? { ...options, captchaToken: t } : options;
}
