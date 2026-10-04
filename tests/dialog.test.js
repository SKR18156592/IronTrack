// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { confirmDialog } from '../src/dialog.js';

const buttons = () => [...document.querySelectorAll('[data-dialog-button]')];

it('keeps the confirm button disabled until the exact text is typed', async () => {
  const answer = confirmDialog('Delete?', { confirmLabel: 'Delete account', danger: true, typeToConfirm: 'DELETE' });
  const input = document.querySelector('.dialog-input');
  const confirm = buttons()[1];
  expect(document.activeElement).toBe(input);
  expect(confirm.disabled).toBe(true);
  input.value = 'delete';
  input.dispatchEvent(new Event('input'));
  expect(confirm.disabled).toBe(true);
  input.value = 'DELETE';
  input.dispatchEvent(new Event('input'));
  expect(confirm.disabled).toBe(false);
  confirm.click();
  expect(await answer).toBe(true);
});

it('works as before without typeToConfirm', async () => {
  const answer = confirmDialog('Sure?');
  expect(document.querySelector('.dialog-input')).toBeNull();
  buttons()[1].click();
  expect(await answer).toBe(true);
});
