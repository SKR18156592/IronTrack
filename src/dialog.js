import { esc } from './storage.js';

// In-app replacements for confirm() and alert(), which block the page and look out of place in an
// installed app. Escape and a click on the backdrop act like the first button (Cancel).

// Resolves true only when the user picks the confirm button.
export function confirmDialog(message, { confirmLabel = 'OK', danger = false } = {}) {
  return openDialog(
    message,
    [
      { label: 'Cancel', value: false, cls: 'btn-secondary' },
      { label: confirmLabel, value: true, cls: danger ? 'btn-danger' : 'btn-primary' }
    ],
    danger ? 0 : 1
  ); // a destructive action isn't the default: Enter cancels
}

export function alertDialog(message) {
  return openDialog(message, [{ label: 'OK', value: undefined, cls: 'btn-primary' }], 0);
}

let dialogCount = 0;

function openDialog(message, buttons, focusIndex) {
  return new Promise(resolve => {
    const id = 'dialogMessage' + ++dialogCount;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay dialog-overlay active';
    overlay.innerHTML = `
      <div class="modal-content dialog" role="alertdialog" aria-modal="true" aria-describedby="${id}">
        <p class="dialog-message" id="${id}">${esc(message).replace(/\n/g, '<br>')}</p>
        <div class="modal-footer">
          ${buttons.map((b, i) => `<button type="button" class="btn ${b.cls}" data-dialog-button="${i}">${esc(b.label)}</button>`).join('')}
        </div>
      </div>`;
    const returnFocus = document.activeElement;
    const close = value => {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
      returnFocus?.focus?.();
      resolve(value);
    };
    const onKey = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(buttons[0].value);
      }
    };
    overlay.addEventListener('click', e => {
      const btn = e.target.closest('[data-dialog-button]');
      if (btn) close(buttons[Number(btn.dataset.dialogButton)].value);
      else if (e.target === overlay) close(buttons[0].value);
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    overlay.querySelector(`[data-dialog-button="${focusIndex}"]`).focus();
  });
}
