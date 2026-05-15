import React, { useContext, useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import { AuthContextType } from '../types';

const AuthNav: React.FC = () => {
  const { user, logout, isAdmin, isLoading } = useContext(AuthContext) as AuthContextType;
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const linkClass = "text-gray-200 hover:text-cyan-400 font-semibold text-base transition-colors hover:scale-105 transform duration-200 whitespace-nowrap";

  if (isLoading) return <div className="w-20" />;

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link to="/login" className={linkClass}>Войти</Link>
        <Link
          to="/register"
          className="px-4 py-2 rounded-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md transition-all hover:scale-105"
        >
          Регистрация
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Всегда видимые */}
      <Link to="/profile" className={linkClass}>👤 Профиль</Link>
      <Link to="/character/create" className={linkClass}>⚡ Создать</Link>
      <Link to="/arena" className={linkClass}>⚔️ Арена</Link>

      {/* Выпадающее меню */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-gray-800/70 border border-white/10 text-gray-200 hover:border-purple-500 hover:text-white font-semibold text-base transition-all"
        >
          ☰ Меню
          <span className={`text-sm transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-60 bg-gray-900/98 backdrop-blur-xl border border-purple-600/50 rounded-2xl shadow-2xl shadow-purple-900/40 overflow-hidden z-[100]">
            <div className="py-1">
              <MenuItem to="/gallery" icon="🖼️" label="Галерея персов" onClick={() => setMenuOpen(false)} />
              <MenuItem to="/archive" icon="📜" label="История" onClick={() => setMenuOpen(false)} />
              <MenuItem to="/leaderboard" icon="🏆" label="Топ" onClick={() => setMenuOpen(false)} />
              <MenuItem to="/graveyard" icon="⚰️" label="Кладбище" onClick={() => setMenuOpen(false)} />
              <MenuItem to="/multiplayer" icon="🎮" label="Мультиплеер" onClick={() => setMenuOpen(false)} />
              {isAdmin && (
                <MenuItem to="/admin" icon="⚙️" label="Админка" onClick={() => setMenuOpen(false)} className="text-yellow-400" />
              )}
              <div className="border-t border-white/10 mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-400 hover:bg-red-900/30 transition-colors text-base font-semibold"
                >
                  🚪 Выйти
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MenuItem: React.FC<{
  to: string;
  icon: string;
  label: string;
  onClick: () => void;
  className?: string;
}> = ({ to, icon, label, onClick, className }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 text-base font-semibold text-gray-200 hover:bg-purple-800/30 hover:text-white transition-colors ${className ?? ''}`}
  >
    <span className="text-lg">{icon}</span>
    {label}
  </Link>
);

export default AuthNav;
