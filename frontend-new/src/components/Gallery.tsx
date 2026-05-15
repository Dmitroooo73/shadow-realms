import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../App';
import { AuthContextType, Character, InventoryItem } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE;

const RACE_ICONS: Record<string, string> = {
  human: '🧑', elf: '🧝', dwarf: '🧔', orc: '👹', tiefling: '😈',
  dragonborn: '🐉', halfling: '🧒', goblin: '👺', vampire: '🧛',
  skeleton: '💀', demon: '😈', wraith: '👻',
};

const CLASS_COLORS: Record<string, string> = {
  warrior:    'from-blue-700 to-cyan-700 border-blue-500',
  berserker:  'from-red-700 to-orange-700 border-red-500',
  rogue:      'from-purple-700 to-violet-700 border-purple-500',
  necromancer:'from-green-800 to-emerald-900 border-green-600',
};

const EFFECT_LABELS: Record<string, { icon: string; label: string }> = {
  heal:        { icon: '💚', label: 'Исцеление' },
  damage:      { icon: '💥', label: 'Урон' },
  berserk:     { icon: '🔥', label: 'Берсерк' },
  stat_boost:  { icon: '💪', label: 'Усиление' },
  cursed:      { icon: '💀', label: 'Проклятие' },
  cure_poison: { icon: '🩹', label: 'Антидот' },
  mystery:     { icon: '🌀', label: 'Загадочный' },
  none:        { icon: '📦', label: 'Разное' },
};

const Gallery: React.FC = () => {
  const { token } = useContext(AuthContext) as AuthContextType;
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryOf, setInventoryOf] = useState<number | null>(null);
  const [items, setItems] = useState<Record<number, InventoryItem[]>>({});
  const [itemsLoading, setItemsLoading] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'alive' | 'dead'>('all');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/characters/`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 100 },
        });
        const raw = res.data;
        setCharacters(Array.isArray(raw) ? raw : raw?.items ?? []);
      } catch {
        setCharacters([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const toggleInventory = useCallback(async (charId: number) => {
    if (inventoryOf === charId) {
      setInventoryOf(null);
      return;
    }
    setInventoryOf(charId);
    if (items[charId]) return;
    setItemsLoading(charId);
    try {
      const res = await axios.get(`${API_BASE}/characters/${charId}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems((prev) => ({ ...prev, [charId]: res.data ?? [] }));
    } catch {
      setItems((prev) => ({ ...prev, [charId]: [] }));
    } finally {
      setItemsLoading(null);
    }
  }, [inventoryOf, items, token]);

  const shown = characters.filter((c) => {
    if (filter === 'alive') return c.is_alive;
    if (filter === 'dead') return !c.is_alive;
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-black text-center mb-2 bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 text-transparent bg-clip-text">
          🖼️ Галерея персонажей
        </h1>
        <p className="text-center text-gray-300 text-lg mb-6">Прям все твои герои - живые и пазорно павшие</p>

        {/* Фильтр */}
        <div className="flex justify-center gap-2 mb-8">
          {(['all', 'alive', 'dead'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2.5 rounded-lg text-base font-bold transition ${
                filter === f
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {f === 'all' ? '⚔️ Все' : f === 'alive' ? '❤️ Живые' : '💀 Павшие'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">Загружаю героев...</div>
        ) : shown.length === 0 ? (
          <div className="text-center text-gray-500 py-20">
            Нет персонажей.{' '}
            <Link to="/character/create" className="text-pink-400 underline">Создать первого мб?</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {shown.map((char) => {
              const cls = CLASS_COLORS[char.character_class || 'warrior'] || CLASS_COLORS.warrior;
              const inv = items[char.id];
              const isInvOpen = inventoryOf === char.id;

              return (
                <div
                  key={char.id}
                  className={`rounded-2xl border bg-black/60 backdrop-blur-xl overflow-hidden transition-shadow hover:shadow-lg hover:shadow-purple-800/30 ${cls.split(' ')[2]}`}
                >
                  {/* Шапка с аватаром */}
                  <div className={`bg-gradient-to-br ${cls.split(' ')[0]} ${cls.split(' ')[1]} p-4 flex items-center gap-3`}>
                    <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white/20 bg-black/30 flex items-center justify-center text-3xl shrink-0">
                      {char.avatar_url
                        ? <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                        : RACE_ICONS[char.race] || '⚔️'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-xl text-white truncate">{char.name}</h3>
                      <div className="text-sm text-white/70">
                        {RACE_ICONS[char.race] || '⚔️'} {char.race} · {char.character_class}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm font-bold">
                        <span className="text-yellow-300">⭐ {char.level ?? 1}</span>
                        <span className={char.is_alive ? 'text-green-300' : 'text-red-400'}>
                          {char.is_alive ? '❤️ Жив' : '💀 Мёртв'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Статы */}
                  <div className="grid grid-cols-3 text-center text-sm border-b border-white/5 divide-x divide-white/5">
                    <div className="py-2.5"><div className="text-red-400 font-bold text-base">{char.hp}</div><div className="text-gray-500 text-xs">HP</div></div>
                    <div className="py-2.5"><div className="text-orange-400 font-bold text-base">{char.strength}</div><div className="text-gray-500 text-xs">Сила</div></div>
                    <div className="py-2.5"><div className="text-blue-400 font-bold text-base">{char.dexterity}</div><div className="text-gray-500 text-xs">Ловк</div></div>
                  </div>

                  {/* Кнопки */}
                  <div className="flex flex-col gap-2 p-3">
                    {char.is_alive && (
                      <Link
                        to={`/story/${char.id}`}
                        className="w-full text-center text-sm font-bold px-3 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg text-white transition"
                      >
                        {char.has_story ? '📜 Продолжить путь' : '🎮 Играть'}
                      </Link>
                    )}
                    <button
                      onClick={() => toggleInventory(char.id)}
                      className={`w-full text-sm font-bold px-3 py-2.5 rounded-lg border transition ${
                        isInvOpen
                          ? 'bg-amber-700/40 border-amber-400/60 text-amber-200'
                          : 'bg-black/30 border-white/10 text-gray-300 hover:border-amber-500/50 hover:text-amber-200'
                      }`}
                    >
                      {itemsLoading === char.id ? '⏳ Загружаю...' : isInvOpen ? '🔒 Закрыть инвентарь' : '📦 Инвентарь'}
                    </button>
                  </div>

                  {/* Инвентарь */}
                  {isInvOpen && (
                    <div className="px-3 pb-3">
                      {itemsLoading === char.id ? (
                        <div className="text-sm text-gray-400 text-center py-2">Загрузка...</div>
                      ) : !inv || inv.length === 0 ? (
                        <div className="text-sm text-gray-500 text-center py-3 bg-black/30 rounded-lg">
                          📭 Инвентарь пуст
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {inv.map((item) => {
                            const ef = EFFECT_LABELS[item.effect_type] ?? EFFECT_LABELS.none;
                            return (
                              <div
                                key={item.id}
                                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-black/40 border border-amber-500/20 text-gray-200"
                              >
                                <span className="text-lg shrink-0">{ef.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold truncate">{item.name}</div>
                                  <div className="text-gray-500 truncate text-xs">{ef.label}{item.effect_value > 0 ? ` +${item.effect_value}` : ''}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Gallery;
