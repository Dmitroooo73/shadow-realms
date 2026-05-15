
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../App';
import { AuthContextType } from '../types';
import Seo from './Seo';
import Inspiration from './Inspiration';
import LiveFeed from './LiveFeed';

const Home: React.FC = () => {
  const { token, user } = useContext(AuthContext) as AuthContextType;

  if (token && user) {
    return (
      <>
        <section className="min-h-[70vh] flex items-center justify-center px-4 pt-12">
          <Seo
            title={`${user.name} — Изумительная бабка AI`}
            description="Твоя персональная страница приключений. Создавай персов и отправляйся в истории."
            canonicalPath="/"
            noIndex
          />
          <div className="text-center max-w-2xl">
            <h1 className="text-5xl md:text-6xl font-black mb-8 text-white drop-shadow-2xl">
              {user.name},
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-red-500 to-purple-600">
                ОТПРАВЛЯЙСЯ В ГРЯЗНЫЕ ПРИКЛЮЧЕНИЯ!
              </span>
            </h1>

            <p className="text-xl md:text-2xl font-bold text-gray-200 leading-relaxed mb-8">
              Твои персы ждут в <Link to="/profile" className="underline hover:text-pink-400 transition">профиле</Link>,
              <br />
              Или сразу в <Link to="/archive" className="underline hover:text-pink-400 transition">Архив историй</Link>!
            </p>

            <div className="text-7xl opacity-20 animate-bounce" aria-hidden="true">
              ⚡
            </div>

            <Inspiration />
          </div>
        </section>
        <LiveFeed />
        <div className="pb-12" />
      </>
    );
  }

  return (
    <section className="min-h-screen flex items-center justify-center px-4">
      <Seo
        title="Изумительная бабка AI - ролевые приключения с AI-мастером"
        description="Создавай персонажей и играй в текстовые RPG-приключения с AI Dungeon Master. Мультиплеер и архив историй."
        canonicalPath="/"
      />
      <div className="text-center max-w-3xl">
        <h1 className="text-5xl md:text-6xl font-black mb-8 text-white drop-shadow-2xl">
          Добро пожаловать в
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400">
            Изумительную бабку AI
          </span>
        </h1>

        <h2 className="sr-only">Ролевые приключения с AI Dungeon Master</h2>

        <p className="text-xl md:text-2xl font-bold text-gray-200 leading-relaxed mb-8">
          Войди в свой нищий акк и начинай создавать персонов,
          <br />
          Чтобы отправиться в грязные приключения с AI-Dungeon Master
        </p>

        <div className="text-7xl opacity-20 animate-bounce" aria-hidden="true">
          ⚡
        </div>

        <Inspiration />
      </div>
    </section>
  );
};

export default Home;