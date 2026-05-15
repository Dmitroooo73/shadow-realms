import { test, expect } from '@playwright/test';

/**
 * E2E smoke-сценарии (Лаба №5, п.4).
 * Проверяют работоспособность публичных маршрутов и SEO.
 */

test.describe('Публичные страницы', () => {
  test('home доступна и содержит h1', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page).toHaveTitle(/Изумительная бабка AI/i);
  });

  test('canonical link присутствует', async ({ page }) => {
    await page.goto('/');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBeTruthy();
  });

  test('login-страница рендерится', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
  });
});

test.describe('Защита маршрутов', () => {
  test('неавторизованного с /profile редиректит на /login', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Вдохновение из D&D (graceful degradation)', () => {
  test('при недоступности backend блок показывает ошибку', async ({ page }) => {
    // Мокаем 503 от бэка
    await page.route('**/api/external/inspiration', (route) =>
      route.fulfill({ status: 503, body: JSON.stringify({ detail: 'down' }) })
    );
    await page.goto('/');
    await page.getByRole('button', { name: /вдохновить/i }).click();
    await expect(page.getByText(/временно недоступ/i)).toBeVisible();
  });
});
