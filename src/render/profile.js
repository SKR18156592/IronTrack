import { renderNutritionPlan } from './nutrition.js';
import { computeTDEE } from './tools.js';
import { esc, getL, setL } from '../storage.js';
import { currentUser, pushToCloud } from '../sync.js';
import { showToast } from '../ui.js';

// ==========================================
// PROFILE & BIOMETRICS MANAGEMENT
// ==========================================
export function saveProfileData() {
  setL('iron_profile_weight', document.getElementById('bodyWeight').value);
  pushToCloud();
}

export function loadProfileData() {
  const w = getL('iron_profile_weight', '72.5');
  if (document.getElementById('bodyWeight')) document.getElementById('bodyWeight').value = w;
  if (document.getElementById('calcWeight')) document.getElementById('calcWeight').value = w;
}

export function loadProfileToCalculator() {
  loadProfileData();
  computeTDEE();
}

export function syncCalculatorToProfile() {
  const w = document.getElementById('calcWeight').value;
  const h = document.getElementById('calcHeight').value;
  const a = document.getElementById('calcAge').value;
  const sex = document.getElementById('calcSex').value;

  setL('iron_profile_weight', w);
  setL('iron_profile_height', h);
  setL('iron_profile_age', a);
  setL('iron_profile_sex', sex);

  if (document.getElementById('bodyWeight')) document.getElementById('bodyWeight').value = w;

  showToast('💾 Weight saved to your profile!', 'success');
  renderNutritionPlan();
  pushToCloud();
}

// The avatar is stored in localStorage and the sync row, so it is downscaled to a small JPEG first.
const AVATAR_MAX_PX = 256;
const AVATAR_MAX_CHARS = 80000;

export function shrinkImageDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, AVATAR_MAX_PX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0a0a0f'; // JPEG has no transparency
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Unsupported image'));
    img.src = dataUrl;
  });
}

export function handleAvatarUpload(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = async function(e) {
      let small;
      try { small = await shrinkImageDataUrl(e.target.result); }
      catch (err) { showToast('❌ That image format is not supported. Try a JPEG or PNG.', 'error'); return; }
      if (!setL('iron_profile_avatar', small)) return;
      updateAvatarDisplay(small);
      showToast('📷 Avatar uploaded successfully!', 'success');
      pushToCloud();
    };
    reader.readAsDataURL(input.files[0]);
  }
  input.value = '';
}

// Avatars saved before downscaling existed can be megabytes: shrink them once.
export async function shrinkStoredAvatar() {
  const avatar = getL('iron_profile_avatar', '');
  if (!avatar || avatar.length <= AVATAR_MAX_CHARS) return;
  try {
    const small = await shrinkImageDataUrl(avatar);
    if (small.length < avatar.length && setL('iron_profile_avatar', small)) {
      updateAvatarDisplay(small);
      pushToCloud();
    }
  } catch (e) { console.warn('Could not shrink stored avatar:', e); }
}

export function updateAvatarDisplay(imgSrcOrNull) {
  const container = document.getElementById('avatarPreviewContainer');
  const initialsEl = document.getElementById('avatarInitials');
  if (!container) return;

  if (imgSrcOrNull && /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(imgSrcOrNull)) {
    container.innerHTML = `<img src="${imgSrcOrNull}" alt="Avatar" />`;
  } else {
    const name = document.getElementById('profileFullName')?.value || 'User';
    const parts = name.trim().split(' ');
    let initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]) : name.slice(0, 2);
    initials = initials.toUpperCase();
    container.innerHTML = `<span id="avatarInitials">${esc(initials)}</span>`;
  }
}

export function loadProfileTabUI() {
  const name = getL('iron_profile_name', '');
  const age = getL('iron_profile_age', '23');
  const weight = getL('iron_profile_weight', '72.5');
  const height = getL('iron_profile_height', '175');
  const sex = getL('iron_profile_sex', 'male');
  const avatar = getL('iron_profile_avatar', null);

  if (document.getElementById('profileFullName')) document.getElementById('profileFullName').value = name;
  if (document.getElementById('profileTabAge')) document.getElementById('profileTabAge').value = age;
  if (document.getElementById('profileTabWeight')) document.getElementById('profileTabWeight').value = weight;
  if (document.getElementById('profileTabHeight')) document.getElementById('profileTabHeight').value = height;
  if (document.getElementById('profileTabSex')) document.getElementById('profileTabSex').value = sex;

  updateAvatarDisplay(avatar);

  if (currentUser && document.getElementById('profileEmailField')) {
    document.getElementById('profileEmailField').value = currentUser.email;
    const syncBadge = document.getElementById('profileSyncBadge');
    if (syncBadge) syncBadge.textContent = 'Cloud Synced';
  }

  computeProfileMetrics();
}

export function saveProfileTab() {
  const name = document.getElementById('profileFullName').value;
  const age = document.getElementById('profileTabAge').value;
  const weight = document.getElementById('profileTabWeight').value;
  const height = document.getElementById('profileTabHeight').value;
  const sex = document.getElementById('profileTabSex').value;

  setL('iron_profile_name', name);
  setL('iron_profile_age', age);
  setL('iron_profile_weight', weight);
  setL('iron_profile_height', height);
  setL('iron_profile_sex', sex);

  if (document.getElementById('bodyWeight')) document.getElementById('bodyWeight').value = weight;

  const avatar = getL('iron_profile_avatar', null);
  if (!avatar) updateAvatarDisplay(null);

  computeProfileMetrics();
  pushToCloud();
}

export function computeProfileMetrics() {
  const weight = parseFloat(document.getElementById('profileTabWeight')?.value) || 0;
  const height = parseFloat(document.getElementById('profileTabHeight')?.value) || 0;
  const age = parseFloat(document.getElementById('profileTabAge')?.value) || 0;
  const sex = document.getElementById('profileTabSex')?.value || 'male';

  const bmiEl = document.getElementById('profileBmiResult');
  const bmrEl = document.getElementById('profileBmrResult');

  if (weight > 0 && height > 0) {
    const heightM = height / 100;
    const bmi = weight / (heightM * heightM);
    let category = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
    if (bmiEl) bmiEl.textContent = `BMI: ${bmi.toFixed(1)} (${category})`;
  } else {
    if (bmiEl) bmiEl.textContent = 'BMI: --';
  }

  if (weight > 0 && height > 0 && age > 0) {
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += (sex === 'male') ? 5 : -161;
    if (bmrEl) bmrEl.textContent = `Estimated BMR: ${bmr.toFixed(0)} kcal/day | Maintenance TDEE: ~${(bmr * 1.55).toFixed(0)} kcal/day`;
  } else {
    if (bmrEl) bmrEl.textContent = 'Estimated BMR: -- kcal/day';
  }
}
