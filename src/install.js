import { showToast } from './ui.js';

// Settings → Install app. Chrome and Edge (Android and desktop) fire beforeinstallprompt when the app
// can be installed; the card's button shows that prompt. Safari has no prompt, so on iPhone and iPad
// the card shows the Add to Home Screen steps instead. Once installed, or opened from the home screen,
// the card stays hidden.

let deferredPrompt = null;

const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

// iPadOS reports itself as a Mac, so a touch screen tells them apart.
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function showCard(mode) {
  const card = document.getElementById('installCard');
  if (!card) return;
  card.hidden = !mode;
  if (!mode) return;
  document.getElementById('installButton').hidden = mode !== 'prompt';
  document.getElementById('installIosSteps').hidden = mode !== 'ios';
}

export async function installApp() {
  if (!deferredPrompt) return;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  if (outcome !== 'accepted') showCard(null);
}

export function initInstall() {
  if (isStandalone()) return;
  if (deferredPrompt) showCard('prompt');
  else if (isIOS()) showCard('ios');
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  if (!isStandalone()) showCard('prompt');
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  showCard(null);
  showToast('IronTrack installed. Open it from your home screen or app list.');
});
