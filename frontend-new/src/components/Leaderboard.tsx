import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../App';
import { AuthContextType } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE;

interface LeaderboardEntry {
  id: number;
  name: string;
  race: string;
  character_class: string;
  level: number;
  xp: number;
  hp: number;
  owner_id: number;
  avatar_url: string | null;
}

const RACE_ICONS: Record<string, string> = {
  human: '🧑', elf: '🧝', dwarf: '🧔', orc: '👹', tiefling: '😈',
  dragonborn: '🐉', halfling: '🧒', goblin: '👺', vampire: '🧛',
};

const CLASS_LABELS: Record<string, string> = {
  warrior: '🛡️ Воин', berserker: '🔥 Берсерк', rogue: '🗡️ Разбойник', necromancer: '💀 Некромант',
};

type Metric = 'level' | 'xp_total' | 'stories';

const METRIC_LABELS: Record<Metric, string> = {
  level: '⭐ По уровню',
  xp_total: '💎 По общему XP',
  stories: '📜 По ходам',
};

const Leaderboard: React.FC = () => {
  const { token } = useContext(AuthContext) as AuthContextType;
  const [metric, setMetric] = useState<Metric>('level');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/leaderboard`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { metric, limit: 50 },
        });
        if (!cancelled) setEntries(res.data || []);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [metric, token]);

  const medal = (idx: number): string => {
    if (idx === 0) return '🥇';
    if (idx === 1) return '🥈';
    if (idx === 2) return '🥉';
    return `#${idx + 1}`;
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-black text-center mb-3 bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-400 text-transparent bg-clip-text">
          🏆 Доска почёта
        </h1>
        <p className="text-center text-gray-300 text-lg mb-6">Топ самых крутых живых героев Shadow Realms</p>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-5 py-2.5 rounded-lg text-base font-bold transition ${
                metric === m
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">Загрузка...</div>
        ) : entries.length === 0 ? (
          <div className="text-center text-gray-500 py-20">📭 Пока нет живых героев, лол</div>
        ) : (
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl border-2 border-purple-600 overflow-hidden">
            {entries.map((e, idx) => (
              <div
                key={e.id}
                className={`flex items-center gap-4 px-4 py-4 border-b border-white/5 ${
                  idx < 3 ? 'bg-gradient-to-r from-yellow-900/20 to-transparent' : ''
                }`}
              >
                <div className="w-14 text-center font-black text-2xl">{medal(idx)}</div>
                <div className="w-14 h-14 rounded-full bg-gray-800 overflow-hidden border border-purple-500/30 flex items-center justify-center text-2xl shrink-0">
                  {e.avatar_url ? (
                    <img src={e.avatar_url} alt={e.name} className="w-full h-full object-cover" />
                  ) : (
                    RACE_ICONS[e.race] || '⚔️'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate text-lg">
                    <Link to={`/story/${e.id}`} className="hover:text-pink-400 transition">
                      {e.name}
                    </Link>
                  </div>
                  <div className="text-sm text-gray-400">
                    {RACE_ICONS[e.race] || '⚔️'} {e.race} · {CLASS_LABELS[e.character_class] || e.character_class}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-yellow-400 text-base">⭐ Ур. {e.level}</div>
                  <div className="text-sm text-gray-500">XP {e.xp} · HP {e.hp}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-6">
          <Link to="/graveyard" className="text-gray-400 hover:text-white text-base">
            ⚰️ Перейти в кладбище пазорно павших
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
