import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../App';
import { AuthContextType } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE;

interface FeedEntry {
  message_id: number;
  character_id: number;
  character_name: string;
  race: string;
  character_class: string;
  owner_id: number;
  owner_name: string;
  user_input: string;
  ai_response: string;
  image_url: string | null;
  timestamp: string;
  likes: number;
  skulls: number;
  fires: number;
}

const RACE_ICONS: Record<string, string> = {
  human: '🧑', elf: '🧝', dwarf: '🧔', orc: '👹', tiefling: '😈',
  dragonborn: '🐉', halfling: '🧒', goblin: '👺', vampire: '🧛',
};

const CLASS_ICONS: Record<string, string> = {
  warrior: '🛡️', berserker: '🔥', rogue: '🗡️', necromancer: '💀',
};

const LiveFeed: React.FC = () => {
  const { token } = useContext(AuthContext) as AuthContextType;
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await axios.get(`${API_BASE}/feed`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 5 },
        });
        if (!cancelled) setFeed(res.data || []);
      } catch {
        if (!cancelled) setFeed([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [token]);

  if (!token) return null;

  return (
    <div className="max-w-3xl mx-auto mt-12 px-4">
      <h2 className="text-2xl font-black mb-4 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent text-center">
        📰 Что происходит прямо сейчас
      </h2>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Заглядываю в хрустальный шар...</div>
      ) : feed.length === 0 ? (
        <div className="text-center text-gray-500 py-8">Пока никто никуда не шёл.</div>
      ) : (
        <div className="space-y-3">
          {feed.map((f) => (
            <Link
              key={f.message_id}
              to={`/archive?search=${encodeURIComponent(f.character_name)}`}
              className="block bg-black/60 backdrop-blur-xl rounded-2xl border-2 border-purple-700/40 hover:border-pink-500 p-4 transition"
            >
              <div className="flex items-start gap-3">
                {f.image_url ? (
                  <img src={f.image_url} alt="" className="w-20 h-20 rounded-xl object-cover border border-purple-500/30 shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-gray-800 flex items-center justify-center text-4xl shrink-0">
                    {RACE_ICONS[f.race] || '⚔️'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate text-sm">
                    <span className="text-pink-400">{f.character_name}</span>
                    <span className="text-gray-500"> ({CLASS_ICONS[f.character_class] || '⚔️'} {f.race})</span>
                  </div>
                  <div className="text-xs text-cyan-400 line-clamp-1 mt-1">→ {f.user_input}</div>
                  <div className="text-xs text-gray-300 line-clamp-2 mt-1">{f.ai_response}</div>
                  <div className="flex gap-3 text-[11px] text-gray-500 mt-2">
                    <span>👍 {f.likes}</span>
                    <span>💀 {f.skulls}</span>
                    <span>🔥 {f.fires}</span>
                    <span className="ml-auto">{new Date(f.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveFeed;
