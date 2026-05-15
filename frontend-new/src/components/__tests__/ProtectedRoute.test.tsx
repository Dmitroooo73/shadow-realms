import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import ProtectedRoute from '../ProtectedRoute';
import { AuthContext } from '../AuthContext';
import type { AuthContextType, User } from '../../types';

function renderWithAuth(ctx: Partial<AuthContextType>, path = '/secret', requireAdmin = false) {
  const value: AuthContextType = {
    token: null,
    user: null,
    isLoading: false,
    isAdmin: false,
    isModerator: false,
    login: async () => {},
    logout: async () => {},
    ...ctx,
  };

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<div>LOGIN PAGE</div>} />
          <Route path="/profile" element={<div>PROFILE PAGE</div>} />
          <Route
            path="/secret"
            element={
              <ProtectedRoute requireAdmin={requireAdmin}>
                <div>SECRET</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

const fakeUser: User = {
  id: 1, email: 'a@b.c', name: 'A', age: 20, role: 'user',
};

describe('ProtectedRoute', () => {
  it('redirects anonymous to /login', () => {
    renderWithAuth({ user: null });
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument();
  });

  it('renders children for authenticated user', () => {
    renderWithAuth({ user: fakeUser, token: 'x' });
    expect(screen.getByText('SECRET')).toBeInTheDocument();
  });

  it('redirects non-admin away from admin-only route', () => {
    renderWithAuth({ user: fakeUser, token: 'x', isAdmin: false }, '/secret', true);
    expect(screen.getByText('PROFILE PAGE')).toBeInTheDocument();
  });

  it('allows admin on admin-only route', () => {
    renderWithAuth(
      { user: { ...fakeUser, role: 'admin' }, token: 'x', isAdmin: true },
      '/secret',
      true
    );
    expect(screen.getByText('SECRET')).toBeInTheDocument();
  });

  it('shows spinner while isLoading', () => {
    const { container } = renderWithAuth({ isLoading: true });
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
