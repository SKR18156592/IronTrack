import { renderNutritionPlan } from './nutrition.js';
import { computeTDEE } from './tools.js';
import { bmi, bmr, hasBodyMetrics, readProfile, tdee } from '../nutrition-targets.js';
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
  const w = getL('iron_profile_weight', '');
  if (document.getElementById('bodyWeight')) document.getElementById('bodyWeight').value = w;
  if (document.getElementById('calcWeight')) document.getElementById('calcWeight').value = w;
}

// Fills the Tools calculator with the saved profile (fields the profile doesn't have keep their value).
export function loadProfileToCalculator() {
  loadProfileData();
  const p = readProfile();
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el && v) el.value = v;
  };
  set('calcAge', p.age);
  set('calcHeight', p.height);
  set('calcSex', p.sex);
  set('calcActivity', String(p.activity));
  computeTDEE();
}

export function syncCalculatorToProfile() {
  const w = document.getElementById('calcWeight').value;
  const h = document.getElementById('calcHeight').value;
  const a = document.getElementById('calcAge').value;
  const sex = document.getElementById('calcSex').value;
  const activity = document.getElementById('calcActivity').value;

  setL('iron_profile_weight', w);
  setL('iron_profile_height', h);
  setL('iron_profile_age', a);
  setL('iron_profile_sex', sex);
  setL('iron_profile_activity', activity);

  if (document.getElementById('bodyWeight')) document.getElementById('bodyWeight').value = w;

  showToast('💾 Saved to your profile!', 'success');
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
    reader.onload = async function (e) {
      let small;
      try {
        small = await shrinkImageDataUrl(e.target.result);
      } catch (err) {
        showToast('❌ That image format is not supported. Try a JPEG or PNG.', 'error');
        return;
      }
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
  } catch (e) {
    console.warn('Could not shrink stored avatar:', e);
  }
}

// Renders the avatar (photo or initials) on the profile screen and on the header button.
export function updateAvatarDisplay(imgSrcOrNull) {
  let face;
  if (imgSrcOrNull && /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(imgSrcOrNull)) {
    face = `<img src="${imgSrcOrNull}" alt="" />`;
  } else {
    const name = (document.getElementById('profileFullName')?.value || getL('iron_profile_name', '') || '').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    const initials = (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)) || '?';
    face = `<span id="avatarInitials">${esc(initials.toUpperCase())}</span>`;
  }
  const container = document.getElementById('avatarPreviewContainer');
  if (container) container.innerHTML = face;
  const header = document.getElementById('headerAvatar');
  if (header) header.innerHTML = face.replace(' id="avatarInitials"', '');
}

export function loadProfileTabUI() {
  const name = getL('iron_profile_name', '');
  const age = getL('iron_profile_age', '');
  const weight = getL('iron_profile_weight', '');
  const height = getL('iron_profile_height', '');
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
  renderNutritionPlan();
  pushToCloud();
}

export function computeProfileMetrics() {
  const p = {
    ...readProfile(),
    weight: parseFloat(document.getElementById('profileTabWeight')?.value) || null,
    height: parseFloat(document.getElementById('profileTabHeight')?.value) || null,
    age: parseFloat(document.getElementById('profileTabAge')?.value) || null,
    sex: document.getElementById('profileTabSex')?.value === 'female' ? 'female' : 'male'
  };
  const bmiEl = document.getElementById('profileBmiResult');
  const bmrEl = document.getElementById('profileBmrResult');

  if (bmiEl) {
    const b = p.weight && p.height ? bmi(p) : null;
    bmiEl.textContent = b ? `BMI: ${b.value.toFixed(1)} (${b.category})` : 'BMI: --';
  }
  if (bmrEl) {
    bmrEl.textContent = hasBodyMetrics(p)
      ? `Estimated BMR: ${bmr(p).toFixed(0)} kcal/day | Maintenance TDEE: ~${tdee(p).toFixed(0)} kcal/day`
      : 'Estimated BMR: -- kcal/day';
  }
}
