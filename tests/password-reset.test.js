// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/ui.js', async importOriginal => ({ ...(await importOriginal()), showToast: vi.fn() }));

const { requestPasswordReset, setSyncContext, submitNewPassword } = await import('../src/sync.js');

const auth = {
  resetPasswordForEmail: vi.fn(async () => ({ error: null })),
  updateUser: vi.fn(async () => ({ error: null }))
};
const submit = () => {
  const form = document.querySelector('form');
  return submitNewPassword({ preventDefault() {}, target: form });
};
const msg = id => document.getElementById(id);

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = `
    <input type="email" id="authEmail" />
    <button id="authForgotBtn"></button>
    <div id="authMsg" hidden></div>
    <div id="resetOverlay" class="active"><form>
      <input id="resetPassword" /><input id="resetPasswordConfirm" />
      <button id="resetSubmitBtn"></button><div id="resetMsg" hidden></div>
    </form></div>`;
  setSyncContext({ client: { auth }, user: null });
});

describe('forgot password', () => {
  it('asks for the email first', async () => {
    await requestPasswordReset();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(msg('authMsg').textContent).toMatch(/Enter your email/);
  });

  it('emails a link back to the app, with the same answer whether or not the account exists', async () => {
    msg('authEmail').value = ' lifter@example.com ';
    await requestPasswordReset();
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('lifter@example.com', {
      redirectTo: location.origin + location.pathname
    });
    expect(msg('authMsg').textContent).toBe(
      "If there's an account for lifter@example.com, a link to reset its password is on its way."
    );
  });

  it('shows the error when the email could not be sent', async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'Email rate limit exceeded' } });
    msg('authEmail').value = 'lifter@example.com';
    await requestPasswordReset();
    expect(msg('authMsg').textContent).toBe('Email rate limit exceeded');
    expect(msg('authForgotBtn').disabled).toBe(false);
  });
});

describe('setting a new password', () => {
  it('checks the length and that both entries match before saving', async () => {
    msg('resetPassword').value = 'abc';
    msg('resetPasswordConfirm').value = 'abc';
    await submit();
    expect(msg('resetMsg').textContent).toMatch(/at least 6/);
    msg('resetPassword').value = 'abcdef1';
    msg('resetPasswordConfirm').value = 'abcdef2';
    await submit();
    expect(msg('resetMsg').textContent).toMatch(/don’t match/);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('saves it and closes the screen', async () => {
    msg('resetPassword').value = 'new-secret';
    msg('resetPasswordConfirm').value = 'new-secret';
    await submit();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-secret' });
    expect(msg('resetOverlay').classList.contains('active')).toBe(false);
  });

  it('keeps the screen open with the error when saving fails', async () => {
    auth.updateUser.mockResolvedValueOnce({
      error: { message: 'New password should be different from the old password.' }
    });
    msg('resetPassword').value = 'same-secret';
    msg('resetPasswordConfirm').value = 'same-secret';
    await submit();
    expect(msg('resetMsg').textContent).toMatch(/different from the old/);
    expect(msg('resetOverlay').classList.contains('active')).toBe(true);
  });
});
