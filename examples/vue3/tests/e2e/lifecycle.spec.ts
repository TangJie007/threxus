import { expect, test } from '@playwright/test';

test('shows dependency startup and reverse disposal', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('[data-state="running"]')).toHaveText('running');
  const initialEvents = page.locator('.event-log li');
  await expect(initialEvents).toHaveCount(4);
  await expect(initialEvents.nth(1)).toContainText('provider 先启动');
  await expect(initialEvents.nth(2)).toContainText('consumer 启动');

  await page.getByRole('button', { name: '验证反向销毁' }).click();

  await expect(page.locator('[data-state="disposed"]')).toHaveText('disposed');
  const disposedEvents = page.locator('.event-log li');
  await expect(disposedEvents).toHaveCount(8);
  await expect(disposedEvents.nth(5)).toContainText('consumer 先销毁');
  await expect(disposedEvents.nth(6)).toContainText('provider 后销毁');
});

test('shows rotating box on dedicated route', async ({ page }) => {
  await page.goto('/cube');

  await expect(page.locator('[data-state="running"]')).toHaveText('running');
  await expect(page.locator('.cube-canvas')).toBeVisible();

  const events = page.locator('.event-log li');
  await expect(events.filter({ hasText: 'M6 acquireTexture' })).toHaveCount(1);
  await expect(events.filter({ hasText: 'M7 acquireGLTF' })).toHaveCount(1);
  await expect(events.filter({ hasText: 'M7 instantiate' })).toHaveCount(2);
  await expect(events.filter({ hasText: 'M11 demo-bridge' })).toHaveCount(1);
  await expect(page.getByText('交互监听', { exact: true })).toBeVisible();
  await expect(page.getByText('Pipeline', { exact: true })).toBeVisible();
  await expect(page.getByText('Graphics', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Simulate Context Lost' }),
  ).toBeVisible();
});

test('shows partial-scope and active-feature rollback', async ({ page }) => {
  await page.goto('/factory-twin');

  await expect(page.locator('[data-state="failed"]')).toHaveText('failed');
  await expect(page.locator('.error')).toContainText(
    'Failed to initialize feature "failing-feature"',
  );

  const events = page.locator('.event-log li');
  await expect(events).toHaveCount(6);
  await expect(events.nth(3)).toContainText('部分资源已清理');
  await expect(events.nth(4)).toContainText('stable-feature 已回滚');
});
