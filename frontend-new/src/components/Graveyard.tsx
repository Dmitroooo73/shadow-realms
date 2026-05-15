import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../App';
import { AuthContextType } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE;

interface GraveyardEntry {
  id: number;
  name: string;
  race: string;
  character_class: string;
  level: number;
  hp: number;
  owner_id: number;
  avatar_url: string | null;
  created_at: string | null;
  total_turns: number;
}

const RACE_ICONS: Record<string, string> = {
  human: '🧑', elf: '🧝', dwarf: '🧔', orc: '👹', tiefling: '😈',
  dragonborn: '🐉', halfling: '🧒', goblin: '👺', vampire: '🧛',
};

const CLASS_LABELS: Record<string, string> = {
  warrior: '🛡️ Воин', berserker: '🔥 Берсерк', rogue: '🗡️ Разбойник', necromancer: '💀 Некромант',
};

const Graveyard: React.FC = () => {
  const { token } = useContext(AuthContext) as AuthContextType;
  const [entries, setEntries] = useState<GraveyardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/graveyard`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 60 },
        });
        if (!cancelled) setEntries(res.data || []);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-black text-center mb-3 bg-gradient-to-r from-gray-300 via-red-400 to-gray-500 text-transparent bg-clip-text">
          ⚰️ Кладбище ну прямо очень позорно павших
        </h1>
        <p className="text-center text-gray-300 text-lg mb-8 italic">
          Здесь покоятся те, кто не дошёл до рассвета и не охмурил принцессу...
        </p>

        {loading ? (
          <div className="text-center text-gray-400 py-20">Копаем могилы...</div>
        ) : entries.length === 0 ? (
          <div className="text-center text-gray-500 py-20">🕊️ Пока никто не пал, пока что</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entries.map((e) => (
              <div
                key={e.id}
                className="bg-black/70 backdrop-blur-xl rounded-2xl border-2 border-gray-700 p-4 hover:border-red-500/50 transition grayscale hover:grayscale-0"
              >
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-xl bg-gray-800 overflow-hidden border border-red-500/30 flex items-center justify-center text-3xl shrink-0">
                    {e.avatar_url ? (
                      <img src={e.avatar_url} alt={e.name} className="w-full h-full object-cover opacity-60" />
                    ) : (
                      RACE_ICONS[e.race] || '💀'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-xl text-red-300 truncate">
                      💀 {e.name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {RACE_ICONS[e.race] || '⚔️'} {e.race} · {CLASS_LABELS[e.character_class] || e.character_class}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Достиг уровня <span className="text-yellow-400 font-bold">{e.level}</span> · Прожил <span className="text-purple-300 font-bold">{e.total_turns}</span> ходов
                    </p>
                    {e.created_at && (
                      <p className="text-xs text-gray-600 mt-1">
                        📅 Рождён: {new Date(e.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-8">
          <Link to="/leaderboard" className="text-gray-400 hover:text-white text-base">
            🏆 Вернуться к живым на доску почёта
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Graveyard;
