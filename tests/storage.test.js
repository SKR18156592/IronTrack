// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { onStorageFailure, setL } from '../src/storage.js';

describe('storage failures', () => {
  it('warns through the registered handler, at most once every 10 seconds', () => {
    const warn = vi.fn();
    onStorageFailure(warn);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    try {
      expect(setL('iron_theme', 'lime')).toBe(false);
      expect(setL('iron_theme', 'cyan')).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/storage is full/);
    } finally {
      setItem.mockRestore();
    }
  });
});
