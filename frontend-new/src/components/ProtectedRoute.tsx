import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import { AuthContextType } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const { user, isLoading, isAdmin } = useContext(AuthContext) as AuthContextType;
  const location = useLocation();

  // Пока грузится токен, показываем крутилку (чтобы не выкидывало раньше времени)
  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin glow"></div>
      </div>
    );
  }

  // Если юзер не залогинен, отправляем на страницу входа, но запоминаем, куда он хотел попасть
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Если страница только для админов, а юзер не админ — кидаем в профиль
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/profile" replace />;
  }

  // Если всё ок — показываем страницу
  return <>{children}</>;
};

export default ProtectedRoute;