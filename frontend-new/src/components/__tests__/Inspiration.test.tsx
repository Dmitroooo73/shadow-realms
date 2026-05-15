import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Inspiration from '../Inspiration';

function mockFetch(response: Partial<Response> & { jsonData?: any }) {
  const fn = vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.jsonData,
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('Inspiration', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders idle state initially', () => {
    render(<Inspiration />);
    expect(screen.getByRole('button', { name: /вдохновить/i })).toBeEnabled();
  });

  it('shows spell on success', async () => {
    mockFetch({
      ok: true,
      status: 200,
      jsonData: {
        kind: 'spell',
        id: 'fireball',
        name: 'Fireball',
        level: 3,
        school: 'Evocation',
        description: 'boom',
      },
    });

    render(<Inspiration />);
    await userEvent.click(screen.getByRole('button', { name: /вдохновить/i }));

    expect(await screen.findByText('Fireball')).toBeInTheDocument();
    expect(screen.getByText(/Evocation/)).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('renders 503 as graceful error message', async () => {
    mockFetch({ ok: false, status: 503, jsonData: {} });

    render(<Inspiration />);
    await userEvent.click(screen.getByRole('button', { name: /вдохновить/i }));

    expect(await screen.findByText(/временно недоступ/i)).toBeInTheDocument();
  });

  it('renders generic error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    render(<Inspiration />);
    await userEvent.click(screen.getByRole('button', { name: /вдохновить/i }));

    expect(await screen.findByText(/не удалось загрузить/i)).toBeInTheDocument();
  });

  it('renders empty state when payload is invalid', async () => {
    mockFetch({ ok: true, status: 200, jsonData: { kind: 'spell' } }); // no name

    render(<Inspiration />);
    await userEvent.click(screen.getByRole('button', { name: /вдохновить/i }));

    expect(await screen.findByText(/не найдено/i)).toBeInTheDocument();
  });
});
