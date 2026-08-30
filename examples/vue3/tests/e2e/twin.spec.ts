import { expect, test } from '@playwright/test';

test('factory twin route boots with threxus HUD', async ({ page }) => {
  await page.goto('/twin');

  await expect(page.getByText('正在构建孪生场景')).toBeHidden({
    timeout: 60_000,
  });
  await expect(page.locator('.twin-canvas')).toBeVisible();
  await expect(page.getByText('设备清单')).toBeVisible();
  await expect(page.locator('.device-list .dev').first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: '环绕' })).toBeVisible();
  await expect(page.getByText(/App running/)).toBeVisible();
});
