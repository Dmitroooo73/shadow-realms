import { defineConfig } from '@playwright/test';

/**
 * E2E-конфиг (Лаба №5, п.4).
 *
 * Требования запуска:
 * 1) Backend поднят на http://127.0.0.1:8000 с тестовой БД
 * 2) Frontend поднят на http://localhost:5173 (npm run dev)
 * 3) Установлены браузеры: npx playwright install chromium
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
