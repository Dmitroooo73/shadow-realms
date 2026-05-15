import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import AuthNav from './components/AuthNav';
import Home from './components/Home';
import BlackPrizmaAuthForm from './components/BlackPrizmaAuthForm';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthContext } from './components/AuthContext';

// Lazy-loading тяжёлых приватных страниц (SEO/perf — Лаб. №4, п.4.1).
const Profile = lazy(() => import('./components/Profile'));
const CharacterCreator = lazy(() => import('./components/CharacterCreator'));
const StoryPage = lazy(() => import('./components/StoryPage'));
const MultiplayerLobby = lazy(() => import('./components/MultiplayerLobby'));
const ArchivePage = lazy(() => import('./components/ArchivePage'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const Leaderboard = lazy(() => import('./components/Leaderboard'));
const Graveyard = lazy(() => import('./components/Graveyard'));
const Arena = lazy(() => import('./components/Arena'));
const Gallery = lazy(() => import('./components/Gallery'));
import {
  celebrateBurst,
  initTiltEffect,
  initRevealAnimation
} from './utils/animations';

const API_BASE = import.meta.env.VITE_API_BASE;

if (!API_BASE) {
  throw new Error(
    'VITE_API_BASE не задан в .env!\n' +
    'Добавь строку в .env:\nVITE_API_BASE=http://127.0.0.1:8000'
  );
}

const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'fantasy'>('dark');
  const auth = useAuth();

  const handleVideoLoad = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    e.currentTarget.classList.add('loaded');
  };

  const handleThemeToggle = () => {
    const newTheme = theme === 'dark' ? 'fantasy' : 'dark';
    setTheme(newTheme);
    
    const btn = document.getElementById('themeBtn');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      celebrateBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    
    document.body.className = `theme-${newTheme}`;
    localStorage.setItem('app-theme', newTheme);
  };

  useEffect(() => {
    const saved = localStorage.getItem('app-theme') as 'dark' | 'fantasy' | null;
    if (saved) {
      setTheme(saved);
      document.body.className = `theme-${saved}`;
    } else {
      document.body.className = 'theme-dark';
    }
    
    initTiltEffect();
    initRevealAnimation();
  }, []);

  return (
    <AuthContext.Provider value={auth}>
      <Router>
        <div className="animated-bg">
          <video 
            autoPlay 
            loop 
            muted 
            playsInline 
            onLoadedData={handleVideoLoad}
          >
            <source src="/preview.mp4" type="video/mp4" />
          </video>
        </div>

        <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-md border-b border-gray-700/50 shadow-2xl">
          <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <Link 
              to="/" 
              className="text-2xl font-black flex items-center gap-3 hover:scale-105 transition-transform"
            >
              <span className="text-4xl filter-none" style={{ textShadow: '0 0 10px rgba(168,85,247,0.8), 0 0 20px rgba(236,72,153,0.6)' }}>
                👾🤑🤥
              </span>
              <span className="gradient-text">
                Изумительная бабка AI
              </span>
            </Link>
            
            <div className="flex items-center gap-4">
              <AuthNav />
              
              <button
                id="themeBtn"
                onClick={handleThemeToggle}
                className={`px-5 py-2.5 rounded-lg font-bold transition-all duration-300 shadow-lg hover:scale-105 ${
                  theme === 'fantasy' 
                    ? 'bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-700 hover:to-red-700 shadow-pink-500/50 animate-pulse text-white' 
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-cyan-500/50 text-white'
                }`}
                title="Переключить тему + салют 🎆"
              >
                {theme === 'dark' ? '✨ Fantasy' : '🌙 Dark'}
              </button>
            </div>
          </div>
        </nav>

        <main className="pt-20 min-h-screen flex flex-col">
          {auth.isLoading ? (
            <div className="flex-1 flex justify-center items-center">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin glow"></div>
            </div>
          ) : (
            <Suspense fallback={
              <div className="flex-1 flex justify-center items-center py-20">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin glow"></div>
              </div>
            }>
              <Routes>
                {/* Публичные страницы */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<BlackPrizmaAuthForm type="login" />} />
                <Route path="/register" element={<BlackPrizmaAuthForm type="register" />} />

                {/* Защищенные страницы (только для залогиненных) */}
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/character/create" element={<ProtectedRoute><CharacterCreator /></ProtectedRoute>} />
                <Route path="/story/:characterId" element={<ProtectedRoute><StoryPage /></ProtectedRoute>} />
                <Route path="/multiplayer" element={<ProtectedRoute><MultiplayerLobby /></ProtectedRoute>} />
                <Route path="/archive" element={<ProtectedRoute><ArchivePage /></ProtectedRoute>} />
                <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
                <Route path="/graveyard" element={<ProtectedRoute><Graveyard /></ProtectedRoute>} />
                <Route path="/arena" element={<ProtectedRoute><Arena /></ProtectedRoute>} />
                <Route path="/gallery" element={<ProtectedRoute><Gallery /></ProtectedRoute>} />

                {/* Только для АДМИНОВ */}
                <Route path="/admin" element={
                  <ProtectedRoute requireAdmin={true}>
                    <AdminPanel />
                  </ProtectedRoute>
                } />
              </Routes>
            </Suspense>
          )}
        </main>
      </Router>
    </AuthContext.Provider>
  );
};

// Back-compat: some pages import AuthContext from "../App"
export { AuthContext };
export default App;