import React, { useState, useContext, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from './AuthContext'; // ПУТЬ ИЗМЕНЕН
import { AuthContextType } from '../types';

interface Props {
  type: 'login' | 'register';
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

const BlackPrizmaAuthForm: React.FC<Props> = ({ type }) => {
  const { login, user } = useContext(AuthContext) as AuthContextType;
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const isLogin = type === 'login';
  const title = isLogin ? 'Вход в Shadow Realms' : 'Регистрация';
  const buttonText = isLogin ? 'Войти' : 'Создать аккаунт';

  // Если юзер уже залогинен, не даем ему сидеть на странице входа
  useEffect(() => {
    if (user) {
      navigate('/profile');
    }
  }, [user, navigate]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!isLogin) {
      if (name.trim().length < 2) {
        errors.name = 'Имя должно быть минимум 2 символа';
      }
      
      const ageNum = parseInt(age);
      if (isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
        errors.age = 'Возраст должен быть от 13 до 120 лет';
      }
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Неверный формат email';
    }
    
    if (password.length < 8) {
      errors.password = 'Пароль должен быть минимум 8 символов';
    } else if (!/[A-Za-z]/.test(password)) {
      errors.password = 'Пароль должен содержать буквы';
    } else if (!/\d/.test(password)) {
      errors.password = 'Пароль должен содержать цифры';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        // Редирект теперь произойдет автоматически из-за useEffect
      } else {
        await axios.post(`${API_BASE}/auth/register`, {
          name: name.trim(),
          age: parseInt(age),
          email: email.toLowerCase(),
          password
        });

        await login(email, password);
      }
    } catch (err: any) {
      setLoading(false);
      
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        
        if (Array.isArray(detail)) {
          const errors: Record<string, string> = {};
          detail.forEach((err: any) => {
            const field = err.loc[err.loc.length - 1];
            errors[field] = err.msg;
          });
          setFieldErrors(errors);
        } else {
          setError(detail);
        }
      } else {
        setError('Ошибка сервера. Попробуйте позже.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative w-full">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-gray-900 to-blue-900/20"></div>
      
      <div className="relative bg-gray-800/90 backdrop-blur-xl border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md p-8 m-auto">
        <h2 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-transparent bg-clip-text">
          {title}
        </h2>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <>
              <div>
                <label htmlFor="name" className="block mb-2 font-semibold text-gray-200">
                  Имя
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Введите имя"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full p-3 rounded-lg bg-gray-700/50 border ${
                    fieldErrors.name ? 'border-red-500' : 'border-gray-600'
                  } focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 outline-none transition-all text-white placeholder-gray-400`}
                  required
                  disabled={loading}
                />
                {fieldErrors.name && (
                  <p className="text-red-400 text-sm mt-1">{fieldErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="age" className="block mb-2 font-semibold text-gray-200">
                  Возраст
                </label>
                <input
                  id="age"
                  type="number"
                  placeholder="Введите возраст"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className={`w-full p-3 rounded-lg bg-gray-700/50 border ${
                    fieldErrors.age ? 'border-red-500' : 'border-gray-600'
                  } focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 outline-none transition-all text-white placeholder-gray-400`}
                  required
                  disabled={loading}
                />
                {fieldErrors.age && (
                  <p className="text-red-400 text-sm mt-1">{fieldErrors.age}</p>
                )}
              </div>
            </>
          )}

          <div>
            <label htmlFor="email" className="block mb-2 font-semibold text-gray-200">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full p-3 rounded-lg bg-gray-700/50 border ${
                fieldErrors.email ? 'border-red-500' : 'border-gray-600'
              } focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 outline-none transition-all text-white placeholder-gray-400`}
              required
              disabled={loading}
            />
            {fieldErrors.email && (
              <p className="text-red-400 text-sm mt-1">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block mb-2 font-semibold text-gray-200">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              placeholder="Минимум 8 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full p-3 rounded-lg bg-gray-700/50 border ${
                fieldErrors.password ? 'border-red-500' : 'border-gray-600'
              } focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 outline-none transition-all text-white placeholder-gray-400`}
              required
              disabled={loading}
            />
            {fieldErrors.password && (
              <p className="text-red-400 text-sm mt-1">{fieldErrors.password}</p>
            )}
            {!isLogin && !fieldErrors.password && (
              <p className="text-gray-400 text-xs mt-1">
                Минимум 8 символов, буквы и цифры
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full p-3 rounded-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-purple-500/50"
            disabled={loading}
          >
            {loading ? '⏳ Загрузка...' : buttonText}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-400">
          {isLogin ? (
            <>
              Нет аккаунта?{' '}
              <Link to="/register" className="text-purple-400 hover:text-purple-300 font-semibold hover:underline transition-colors">
                Зарегистрируйся
              </Link>
            </>
          ) : (
            <>
              Уже есть аккаунт?{' '}
              <Link to="/login" className="text-purple-400 hover:text-purple-300 font-semibold hover:underline transition-colors">
                Войти
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default BlackPrizmaAuthForm;