import { expect, test } from '@playwright/test';

// Smoke tests for the main flows, signed out (data stays on the device). Supabase and Google Fonts
// are blocked so the tests never depend on the network.

const openCard = '.day-view.active .exercise-card:not(.collapsed)';
let problems;

test.beforeEach(async ({ page }) => {
  problems = [];
  page.on('pageerror', e => problems.push(`page error: ${e.message}`));
  page.on('dialog', d => { problems.push(`native dialog: ${d.message()}`); d.dismiss(); });
  await page.route(/supabase\.co|fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.goto('/');
  await page.click('[data-on-click="skipSignIn"]');
  await expect(page.locator(openCard).first()).toBeVisible();
});

test.afterEach(() => {
  expect(problems).toEqual([]);
});

test('logs a set, saves the session, and keeps it after a reload', async ({ page }) => {
  const weight = page.locator(`${openCard} .set-weight`).first();
  const before = Number(await weight.inputValue() || 0);
  await page.locator(`${openCard} .stepper-btn[aria-label="More weight"]`).first().click();
  await expect(weight).toHaveValue(String(before + 2.5));
  await page.locator(`${openCard} .check-btn`).first().click();

  await page.click('[data-on-click="finishCurrentDayWorkout"]');
  await expect(page.locator('#celebrationOverlay')).toHaveClass(/active/);
  await page.click('#celebrationOverlay [data-on-click="closeCelebration"]');

  const sessions = page.locator('#historyListContainer .log-item');
  await page.click('[data-on-click="openHistoryModal"]');
  await expect(sessions).toHaveCount(1);

  await page.reload();
  await page.click('[data-on-click="openHistoryModal"]');
  await expect(sessions).toHaveCount(1);
});

test('restores an in-progress session after a reload', async ({ page }) => {
  const weight = page.locator(`${openCard} .set-weight`).first();
  await weight.fill('123.5');
  await page.waitForTimeout(500); // the draft saves 300 ms after the last edit
  await page.reload();
  await expect(page.locator('.day-view.active .exercise-card .set-weight').first()).toHaveValue('123.5');
});

test('asks before removing an exercise, and Cancel keeps it', async ({ page }) => {
  const cards = page.locator('.day-view.active .exercise-card');
  const count = await cards.count();
  await page.click('[data-on-click="toggleEditMode"]');
  const remove = page.locator('.day-view.active [data-on-click="removeExercise"]').first();

  await remove.click();
  await page.click('.dialog .btn-secondary');
  await expect(cards).toHaveCount(count);

  await remove.click();
  await page.click('.dialog .btn-danger');
  await expect(cards).toHaveCount(count - 1);
});

test('every tab opens', async ({ page }) => {
  for (const tab of ['analytics', 'nutrition', 'tools', 'settings', 'workout']) {
    await page.click(`.bottom-tab[data-tab="${tab}"]`);
    await expect(page.locator(`#view-${tab}`)).toHaveClass(/active/);
  }
});

test('starts offline after the first visit', async ({ page, context }) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.day-view.active .exercise-card').first()).toBeVisible();
  // Any other URL in scope (e.g. a launch with a query string) also gets the app shell.
  await page.goto('/?source=homescreen');
  await expect(page.locator('.day-view.active .exercise-card').first()).toBeVisible();
});
