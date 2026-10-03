import { showToast } from './ui.js';

export function getL(k, def) {
  try {
    const v = localStorage.getItem(k);
    return v === null ? def : v;
  } catch (e) {
    return def;
  }
}
// Writes return false on failure (almost always the ~5 MB localStorage quota) and warn the user.
let lastStorageWarningAt = 0;
export function reportStorageFailure(err) {
  console.error('localStorage write failed:', err);
  if (Date.now() - lastStorageWarningAt < 10000) return;
  lastStorageWarningAt = Date.now();
  showToast('⚠️ Device storage is full: recent changes were not saved. Export a full backup from Settings.', 'error');
}
export function setL(k, v) {
  try {
    localStorage.setItem(k, v);
    return true;
  } catch (e) {
    reportStorageFailure(e);
    return false;
  }
}
export function getJ(k, def) {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : def;
  } catch (e) {
    return def;
  }
}
export function setJ(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch (e) {
    reportStorageFailure(e);
    return false;
  }
}

// Escape text before it goes into an innerHTML template.
export function esc(v) {
  return String(v ?? '').replace(
    /[&<>"']/g,
    ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
  );
}
// IDs go unescaped into element ids, attributes and selectors, so they are limited to these characters.
export function isSafeId(v) {
  return /^[A-Za-z0-9_-]+$/.test(String(v ?? ''));
}
export function safeId(v) {
  return String(v ?? '').replace(/[^A-Za-z0-9_-]/g, '');
}
