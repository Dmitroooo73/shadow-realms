import { useState, useEffect } from 'react';
import axios from 'axios';
import { AuthContextType, User } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE;
if (!API_BASE) throw new Error('❌ VITE_API_BASE не задан в .env');

export const api = axios.create({ baseURL: API_BASE });

export const useAuth = (): AuthContextType => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Состояние загрузки

  // Настройка Интерцепторов (Авто-рефреш при 401 ошибке)
  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use((config) => {
      const currentToken = localStorage.getItem('token');
      if (currentToken) {
        config.headers.Authorization = `Bearer ${currentToken}`;
      }
      return config;
    });

    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            console.log('🔄 Токен истек, обновляем...');
            const res = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
            const newToken = res.data.access_token;
            
            localStorage.setItem('token', newToken);
            setToken(newToken);
            
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          } catch (refreshError) {
            logout();
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Первичная проверка при загрузке страницы
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        try {
          const res = await api.get('/users/me');
          setUser(res.data);
        } catch (err) {
          console.error("Ошибка авто-входа", err);
        }
      }
      setIsLoading(false); // Загрузка завершена в любом случае
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);

      const res = await api.post("/auth/token", formData, { withCredentials: true });
      const accessToken = res.data.access_token;
      
      localStorage.setItem("token", accessToken);
      setToken(accessToken);
      
      const userRes = await api.get("/users/me");
      setUser(userRes.data);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {}, { withCredentials: true });
    } catch (err) {
      console.warn('Локальный выход');
    }
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';
  const isModerator = user?.role === 'moderator' || user?.role === 'admin';

  return { token, user, isLoading, isAdmin, isModerator, login, logout, setUser };
};