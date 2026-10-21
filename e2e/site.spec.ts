import { expect, test } from '@playwright/test';

test('pick a nickname on the landing page and land in the hub', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('> Pick a nickname').fill('kopiboi');
  await page.getByRole('button', { name: /jom masuk/i }).click();
  await expect(page).toHaveURL(/\/hub$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/kopiboi/i);
});

test('the menu lists apps and opens them', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lepak.nickname', 'kopiboi'));
  await page.goto('/hub');
  await page.getByRole('button', { name: /menu/i }).click();
  const menu = page.getByRole('dialog', { name: 'All apps' });
  await expect(menu).toBeVisible();
  await menu.getByPlaceholder('Find an app...').fill('tool');
  await menu.getByRole('link', { name: /toolbox/i }).click();
  await expect(page).toHaveURL(/\/tools$/);
  await expect(menu).toBeHidden();
});

test('the wordmark goes app -> hub -> landing', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lepak.nickname', 'kopiboi'));
  await page.goto('/tools');
  await page.getByRole('link', { name: 'LEPAK.GG hub' }).click();
  await expect(page).toHaveURL(/\/hub$/);
  await page.getByRole('link', { name: 'LEPAK.GG home page' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('privacy and terms pages load', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy.');
  await expect(page.getByRole('link', { name: 'lepak.gg.my@gmail.com' }).first()).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Terms.');
});
