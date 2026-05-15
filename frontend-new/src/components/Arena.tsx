import React, { useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from '../App';
import { AuthContextType, Character } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE;

interface Opponent {
  id: number;
  name: string;
  race: string;
  character_class: string;
  level: number;
  hp: number;
  strength: number;
  dexterity: number;
  owner_id: number;
  owner_name: string;
  avatar_url: string | null;
}

interface Match {
  id: number;
  attacker_id: number;
  attacker_name: string;
  defender_id: number;
  defender_name: string;
  winner_id: number | null;
  winner_name: string | null;
  rounds: number;
  log: string;
  xp_gained: number;
  created_at: string;
}

const RACE_ICONS: Record<string, string> = {
  human: '🧑', elf: '🧝', dwarf: '🧔', orc: '👹', tiefling: '😈',
  dragonborn: '🐉', halfling: '🧒', goblin: '👺', vampire: '🧛',
};

const CLASS_ICONS: Record<string, string> = {
  warrior: '🛡️', berserker: '🔥', rogue: '🗡️', necromancer: '💀',
};

const Arena: React.FC = () => {
  const { token } = useContext(AuthContext) as AuthContextType;

  const [myChars, setMyChars] = useState<Character[]>([]);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [history, setHistory] = useState<Match[]>([]);
  const [attackerId, setAttackerId] = useState<number | null>(null);
  const [opponentId, setOpponentId] = useState<number | null>(null);
  const [fighting, setFighting] = useState(false);
  const [result, setResult] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [charsRes, oppsRes, histRes] = await Promise.all([
        axios.get(`${API_BASE}/characters/`, { ...authHeader, params: { limit: 50 } }),
        axios.get(`${API_BASE}/arena/opponents`, { ...authHeader, params: { limit: 30 } }),
        axios.get(`${API_BASE}/arena/history`, { ...authHeader, params: { limit: 20 } }),
      ]);
      const chars: Character[] = charsRes.data?.items || [];
      const alive = chars.filter((c) => c.is_alive);
      setMyChars(alive);
      setOpponents(oppsRes.data || []);
      setHistory(histRes.data || []);
      if (!attackerId && alive.length > 0) setAttackerId(alive[0].id);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, attackerId]);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fight = async () => {
    if (!attackerId || !opponentId || fighting) return;
    setFighting(true);
    setError(null);
    setResult(null);
    try {
      const res = await axios.post(
        `${API_BASE}/arena/fight`,
        { attacker_id: attackerId, defender_id: opponentId },
        authHeader,
      );
      setResult(res.data);
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Бой сорвался');
    } finally {
      setFighting(false);
    }
  };

  if (!token) {
    return <div className="container mx-auto px-4 py-20 text-center text-gray-400">Войди, чтобы драться.</div>;
  }

  const attacker = myChars.find((c) => c.id === attackerId);
  const opponent = opponents.find((o) => o.id === opponentId);

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black text-center mb-3 bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 text-transparent bg-clip-text">
          ⚔️ Арена
        </h1>
        <p className="text-center text-gray-400 mb-8">Поединок без смертей! Победитель получает XP и целый один предмет из инвентаря соперника. Проигравший с позором теряет 10% XP. Компаньоны братки дерутся рядом. Лимитка: 5 дуэлей в день.</p>

        {loading ? (
          <div className="text-center text-gray-400 py-20">Настраиваю бойцов, спину прямо...</div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Твой боец */}
              <div className="bg-black/60 backdrop-blur-xl rounded-2xl border-2 border-pink-600 p-5">
                <h3 className="text-lg font-black mb-3 text-pink-300">🩸 Твой боец</h3>
                {myChars.length === 0 ? (
                  <div className="text-gray-500 text-sm">Нет живых персонажей, бро. Создай в профиле пж.</div>
                ) : (
                  <>
                    <select
                      value={attackerId ?? ''}
                      onChange={(e) => setAttackerId(Number(e.target.value))}
                      className="w-full bg-gray-900 border border-purple-600 rounded-lg px-3 py-2 text-white mb-3"
                    >
                      {myChars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (ур. {c.level ?? 1})
                        </option>
                      ))}
                    </select>
                    {attacker && (
                      <div className="text-sm text-gray-300 space-y-1">
                        <div><span className="text-gray-500">Раса:</span> {RACE_ICONS[attacker.race] || '⚔️'} {attacker.race}</div>
                        <div><span className="text-gray-500">Класс:</span> {CLASS_ICONS[attacker.character_class || 'warrior']} {attacker.character_class}</div>
                        <div>HP {attacker.hp} · STR {attacker.strength} · DEX {attacker.dexterity}</div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Противник */}
              <div className="bg-black/60 backdrop-blur-xl rounded-2xl border-2 border-red-600 p-5">
                <h3 className="text-lg font-black mb-3 text-red-300">🔥 Противник</h3>
                {opponents.length === 0 ? (
                  <div className="text-gray-500 text-sm">Никого нет на арене, трусы. Подожди, пока кто-то создаст героя.</div>
                ) : (
                  <>
                    <select
                      value={opponentId ?? ''}
                      onChange={(e) => setOpponentId(Number(e.target.value))}
                      className="w-full bg-gray-900 border border-red-600 rounded-lg px-3 py-2 text-white mb-3"
                    >
                      <option value="">— Выбери скорей соперника —</option>
                      {opponents.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} (ур. {o.level}) · от {o.owner_name}
                        </option>
                      ))}
                    </select>
                    {opponent && (
                      <div className="text-sm text-gray-300 space-y-1">
                        <div><span className="text-gray-500">Раса:</span> {RACE_ICONS[opponent.race] || '⚔️'} {opponent.race}</div>
                        <div><span className="text-gray-500">Класс:</span> {CLASS_ICONS[opponent.character_class || 'warrior']} {opponent.character_class}</div>
                        <div>HP {opponent.hp} · STR {opponent.strength} · DEX {opponent.dexterity}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="text-center mb-8">
              <button
                onClick={fight}
                disabled={fighting || !attackerId || !opponentId}
                className="px-10 py-4 rounded-xl text-xl font-black bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 text-white shadow-lg hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {fighting ? '⚔️ Бьются...' : '⚔️ В БОЙ!'}
              </button>
              {error && <div className="text-red-400 mt-3 text-sm">{error}</div>}
            </div>

            {result && (
              <div className={`backdrop-blur-xl rounded-2xl border-2 p-5 mb-8 ${result.winner_name ? 'bg-black/70 border-yellow-500' : 'bg-black/70 border-gray-500'}`}>
                <h3 className="text-xl font-black mb-1">
                  {result.winner_name
                    ? (result.winner_id === result.attacker_id
                        ? `🏆 Победа, как же ты офигенен! ${result.winner_name} торжествует`
                        : `😤 Поражение, найс трай братик — ${result.winner_name} победил`)
                    : '🤝 Ничья — оба выстояли, респект мужики'}
                </h3>
                <p className="text-sm text-gray-400 mb-3">
                  +{result.xp_gained} XP победителю · {result.rounds} раунд(ов)
                </p>
                <pre className="text-base text-gray-100 whitespace-pre-wrap font-mono bg-black/40 rounded-lg p-4 max-h-96 overflow-y-auto leading-loose">{result.log}</pre>
              </div>
            )}

            {history.length > 0 && (
              <div>
                <h3 className="text-xl font-black mb-3 text-purple-300">📜 История боёв</h3>
                <div className="space-y-2">
                  {history.map((m) => (
                    <details key={m.id} className="bg-black/50 backdrop-blur rounded-xl border border-purple-700/40 p-3">
                      <summary className="cursor-pointer text-base">
                        <span className="font-bold">{m.attacker_name}</span>
                        <span className="text-gray-500"> vs </span>
                        <span className="font-bold">{m.defender_name}</span>
                        <span className="ml-2 text-gray-400">
                          {m.winner_name ? `→ 🏆 ${m.winner_name}` : '→ 🤝 ничья'}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">({m.rounds} р.)</span>
                      </summary>
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono mt-2 max-h-64 overflow-y-auto">{m.log}</pre>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Arena;
