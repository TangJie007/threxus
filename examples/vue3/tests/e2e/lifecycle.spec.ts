import { expect, test } from '@playwright/test';

test('shows dependency startup and reverse disposal', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('[data-state="running"]')).toHaveText('running');
  const initialEvents = page.locator('.event-log li');
  await expect(initialEvents).toHaveCount(5);
  await expect(initialEvents.nth(1)).toContainText('scheduler-demo');
  await expect(initialEvents.nth(2)).toContainText('provider 先启动');
  await expect(initialEvents.nth(3)).toContainText('consumer 启动');

  await page.getByRole('button', { name: '验证反向销毁' }).click();

  await expect(page.locator('[data-state="disposed"]')).toHaveText('disposed');
  const disposedEvents = page.locator('.event-log li');
  await expect(disposedEvents).toHaveCount(9);
  await expect(disposedEvents.nth(6)).toContainText('consumer 先销毁');
  await expect(disposedEvents.nth(7)).toContainText('provider 后销毁');
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
