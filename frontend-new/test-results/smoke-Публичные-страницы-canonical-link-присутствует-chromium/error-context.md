# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Публичные страницы >> canonical link присутствует
- Location: e2e\smoke.spec.ts:15:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/
Call log:
  - navigating to "http://localhost:5173/", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * E2E smoke-сценарии (Лаба №5, п.4).
  5  |  * Проверяют работоспособность публичных маршрутов и SEO.
  6  |  */
  7  | 
  8  | test.describe('Публичные страницы', () => {
  9  |   test('home доступна и содержит h1', async ({ page }) => {
  10 |     await page.goto('/');
  11 |     await expect(page.locator('h1')).toBeVisible();
  12 |     await expect(page).toHaveTitle(/Изумительная бабка AI/i);
  13 |   });
  14 | 
  15 |   test('canonical link присутствует', async ({ page }) => {
> 16 |     await page.goto('/');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/
  17 |     const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  18 |     expect(canonical).toBeTruthy();
  19 |   });
  20 | 
  21 |   test('login-страница рендерится', async ({ page }) => {
  22 |     await page.goto('/login');
  23 |     await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
  24 |   });
  25 | });
  26 | 
  27 | test.describe('Защита маршрутов', () => {
  28 |   test('неавторизованного с /profile редиректит на /login', async ({ page }) => {
  29 |     await page.goto('/profile');
  30 |     await expect(page).toHaveURL(/\/login/);
  31 |   });
  32 | });
  33 | 
  34 | test.describe('Вдохновение из D&D (graceful degradation)', () => {
  35 |   test('при недоступности backend блок показывает ошибку', async ({ page }) => {
  36 |     // Мокаем 503 от бэка
  37 |     await page.route('**/api/external/inspiration', (route) =>
  38 |       route.fulfill({ status: 503, body: JSON.stringify({ detail: 'down' }) })
  39 |     );
  40 |     await page.goto('/');
  41 |     await page.getByRole('button', { name: /вдохновить/i }).click();
  42 |     await expect(page.getByText(/временно недоступ/i)).toBeVisible();
  43 |   });
  44 | });
  45 | 
```