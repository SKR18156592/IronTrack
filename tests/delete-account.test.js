// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The confirmation is answered by each test; the real dialog is tested below.
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn(async () => {}) }));
vi.mock('../src/dialog.js', () => ({ confirmDialog: dialogs.confirm, alertDialog: dialogs.alert }));
vi.mock('../src/ui.js', async importOriginal => ({ ...(await importOriginal()), showToast: vi.fn() }));

const { deleteAccount, setSyncContext } = await import('../src/sync.js');
const { showToast } = await import('../src/ui.js');

const USER = { id: 'user-1', email: 'sam@gmail.com' };
let client;
const reload = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('iron_profile_name', 'Sam');
  localStorage.setItem('irontrack_owner', USER.id);
  client = {
    rpc: vi.fn(async () => ({ data: null, error: null })),
    auth: { signOut: vi.fn(async () => ({ error: null })) },
    removeChannel: vi.fn()
  };
  setSyncContext({ client, user: USER });
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  Object.defineProperty(window, 'location', { value: { ...window.location, reload }, configurable: true });
});

describe('deleteAccount', () => {
  it('asks for DELETE to be typed, and does nothing when cancelled', async () => {
    dialogs.confirm.mockResolvedValue(false);
    await deleteAccount();
    expect(dialogs.confirm).toHaveBeenCalledWith(expect.stringContaining('sam@gmail.com'), {
      confirmLabel: 'Delete account',
      danger: true,
      typeToConfirm: 'DELETE'
    });
    expect(client.rpc).not.toHaveBeenCalled();
    expect(localStorage.getItem('iron_profile_name')).toBe('Sam');
  });

  it('deletes the account on the server, then clears this device and reloads', async () => {
    dialogs.confirm.mockResolvedValue(true);
    await deleteAccount();
    expect(client.rpc).toHaveBeenCalledWith('delete_own_account');
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(localStorage.getItem('iron_profile_name')).toBeNull();
    expect(localStorage.getItem('irontrack_owner')).toBeNull();
    expect(dialogs.alert).toHaveBeenCalledWith('Your account and its synced data have been deleted.');
    expect(reload).toHaveBeenCalled();
  });

  it('keeps everything when the server refuses', async () => {
    dialogs.confirm.mockResolvedValue(true);
    client.rpc.mockResolvedValue({ data: null, error: { code: '500', message: 'boom' } });
    await deleteAccount();
    expect(dialogs.alert).toHaveBeenCalledWith(
      expect.stringMatching(/couldn't be deleted \(boom\)\. Nothing was deleted/)
    );
    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(localStorage.getItem('iron_profile_name')).toBe('Sam');
    expect(reload).not.toHaveBeenCalled();
  });

  it('explains when the server has no delete function yet', async () => {
    dialogs.confirm.mockResolvedValue(true);
    client.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await deleteAccount();
    expect(dialogs.alert).toHaveBeenCalledWith(
      "Account deletion isn't available on this server yet. Nothing was deleted."
    );
    expect(localStorage.getItem('iron_profile_name')).toBe('Sam');
  });

  it('needs a connection', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await deleteAccount();
    expect(dialogs.confirm).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Connect to the internet to delete your account.', 'error');
  });
});
