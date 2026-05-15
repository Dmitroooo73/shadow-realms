import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Очистка DOM и моков между тестами (Лаба №5, п.5.4).
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// VITE_API_BASE должен быть доступен в тестах.
if (!import.meta.env.VITE_API_BASE) {
  (import.meta as any).env.VITE_API_BASE = 'http://test.local';
}
