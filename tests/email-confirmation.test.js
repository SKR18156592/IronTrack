// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { suggestEmailFix } from '../src/email-check.js';

vi.mock('../src/ui.js', async importOriginal => ({ ...(await importOriginal()), showToast: vi.fn() }));

const { handleAuthSubmit, resendConfirmation, setSyncContext, toggleAuthMode, useSuggestedEmail } =
  await import('../src/sync.js');

const auth = {
  signUp: vi.fn(async () => ({ data: { user: { id: 'u1' }, session: null }, error: null })),
  signInWithPassword: vi.fn(),
  resend: vi.fn(async () => ({ error: null }))
};
const el = id => document.getElementById(id);
const submit = () => handleAuthSubmit({ preventDefault() {} });
const fill = (email, password = 'secret123') => {
  el('authEmail').value = email;
  el('authPassword').value = password;
};

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = `
    <div id="authOverlay" class="active"><h2 id="authTitle"></h2>
      <input id="authEmail" /><input id="authPassword" /><button id="authForgotBtn"></button>
      <button id="authSubmitBtn"></button><span id="authToggleText"></span><button id="authToggleBtn"></button>
      <div id="authMsg"></div><button id="authFixEmailBtn" hidden></button><button id="authResendBtn" hidden></button>
    </div>`;
  setSyncContext({ client: { auth }, user: null });
});

describe('suggestEmailFix', () => {
  it('catches typos in common domains', () => {
    expect(suggestEmailFix('sam@gmial.com')).toBe('sam@gmail.com');
    expect(suggestEmailFix('sam@gmail.con')).toBe('sam@gmail.com');
    expect(suggestEmailFix('sam@hotmial.com')).toBe('sam@hotmail.com');
    expect(suggestEmailFix('sam@yahooo.com')).toBe('sam@yahoo.com');
  });

  it('leaves correct, real and unrelated domains alone', () => {
    for (const email of ['sam@gmail.com', 'sam@ymail.com', 'sam@mail.com', 'sam@company.io', 'sam@iitkgp.ac.in']) {
      expect(suggestEmailFix(email), email).toBeNull();
    }
  });
});

describe('creating an account', () => {
  beforeEach(() => toggleAuthMode()); // into sign-up mode (module state: toggled back after each test)
  afterEach(() => toggleAuthMode());

  it('asks the user to confirm their address instead of signing them in', async () => {
    fill('sam@gmail.com');
    await submit();
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'sam@gmail.com',
      password: 'secret123',
      options: { emailRedirectTo: location.origin + location.pathname }
    });
    expect(el('authMsg').textContent).toMatch(/we sent a link to sam@gmail.com/);
    expect(el('authResendBtn').hidden).toBe(false);
    expect(el('authOverlay').classList.contains('active')).toBe(true);
  });

  it('labels the switch back to signing in', () => {
    expect(el('authToggleBtn').textContent).toBe('Sign in');
  });

  it('warns once about a likely typo, and goes ahead if the user insists', async () => {
    fill('sam@gmial.com');
    await submit();
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(el('authMsg').textContent).toMatch(/Did you mean sam@gmail.com/);
    expect(el('authFixEmailBtn').hidden).toBe(false);
    await submit();
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'sam@gmial.com' }));
  });

  it('fixes the address with one tap', async () => {
    fill('sam@gmial.com');
    await submit();
    useSuggestedEmail();
    expect(el('authEmail').value).toBe('sam@gmail.com');
    expect(el('authFixEmailBtn').hidden).toBe(true);
  });

  it('resends the confirmation email to the same address', async () => {
    fill('sam@gmail.com');
    await submit();
    await resendConfirmation();
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'sam@gmail.com',
      options: { emailRedirectTo: location.origin + location.pathname }
    });
    expect(el('authMsg').textContent).toMatch(/Sent again/);
  });
});

describe('signing in before confirming', () => {
  it('explains what to do and offers to resend', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' }
    });
    fill('sam@gmail.com');
    await submit();
    expect(el('authMsg').textContent).toBe('Confirm your email first: open the link we sent to sam@gmail.com.');
    expect(el('authResendBtn').hidden).toBe(false);
  });
});
