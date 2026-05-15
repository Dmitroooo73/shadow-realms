import React, { useState, useEffect, useContext, useRef } from 'react';
import axios, { AxiosError } from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import { AuthContextType, Character, InventoryItem } from '../types';
import { healPulse, damageFlash, levelUpEffect, darkPortal } from '../utils/animations';

const API_BASE = import.meta.env.VITE_API_BASE;

const xpThreshold = (level: number) => 50 + Math.max(0, level - 1) * 75;

const effectLabel: Record<string, { icon: string; color: string; text: string; unit: string }> = {
  heal: { icon: '💚', color: 'text-green-300 border-green-500/40 bg-green-900/20', text: 'Лечение', unit: 'HP' },
  damage: { icon: '💥', color: 'text-red-300 border-red-500/40 bg-red-900/20', text: 'Урон', unit: 'HP' },
  cure_poison: { icon: '🧪', color: 'text-cyan-300 border-cyan-500/40 bg-cyan-900/20', text: 'Противоядие', unit: '' },
  berserk: { icon: '🔥', color: 'text-orange-300 border-orange-500/40 bg-orange-900/20', text: 'Берсерк', unit: 'ходов' },
  cursed: { icon: '☠️', color: 'text-rose-300 border-rose-500/40 bg-rose-900/20', text: 'Проклятье', unit: 'HP' },
  stat_boost: { icon: '⚡', color: 'text-yellow-300 border-yellow-500/40 bg-yellow-900/20', text: 'Бафф статов', unit: 'к STR/DEX' },
  mystery: { icon: '🌀', color: 'text-purple-300 border-purple-500/40 bg-purple-900/20', text: 'Загадочное (рандом!)', unit: '' },
  none: { icon: '📦', color: 'text-gray-300 border-gray-500/40 bg-gray-900/20', text: 'Предмет', unit: '' },
};

const formatItemEffect = (etype: string, val: number): string => {
  const meta = effectLabel[etype] || effectLabel.none;
  if (!val) return meta.text;
  const sign = (etype === 'damage' || etype === 'cursed') ? '−' : '+';
  return `${meta.text} · ${sign}${val}${meta.unit ? ' ' + meta.unit : ''}`;
};

interface StoryEntry {
  id: number;
  character_id: number;
  user_input: string;
  ai_response: string;
  image_url: string | null;
  timestamp: string;
}

const StoryPage: React.FC = () => {
  const { token } = useContext(AuthContext) as AuthContextType;
  const { characterId: urlCharacterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [story, setStory] = useState<StoryEntry[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('dark');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [usingItemId, setUsingItemId] = useState<number | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const storyContainerRef = useRef<HTMLDivElement>(null);

  const scrollStoryToBottom = () => {
    const el = storyContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    // Скроллим сразу (текст уже есть) и через задержки — картинка декодируется асинхронно
    scrollStoryToBottom();
    const t1 = setTimeout(scrollStoryToBottom, 300);
    const t2 = setTimeout(scrollStoryToBottom, 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [story]);

  const HINT_LETTERS = ['А', 'Б', 'В'];
  const HINT_SHORTCUT: Record<string, number> = {
    a: 0, A: 0, а: 0, А: 0,
    b: 1, B: 1, б: 1, Б: 1,
    c: 2, C: 2, в: 2, В: 2,
  };
  const resolveInputToAction = (raw: string): string => {
    const t = (raw || '').trim();
    if (t.length === 1 && HINT_SHORTCUT[t] !== undefined && hints[HINT_SHORTCUT[t]]) {
      return hints[HINT_SHORTCUT[t]];
    }
    return t;
  };

  const loadInventory = async (charId: number) => {
    try {
      const res = await axios.get(`${API_BASE}/characters/${charId}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInventory(res.data || []);
    } catch {
      setInventory([]);
    }
  };

  const handleUseItem = async (itemId: number) => {
    if (!selectedChar || usingItemId) return;
    const itemBefore = inventory.find((i) => i.id === itemId);
    const hpBefore = selectedChar.hp;
    setUsingItemId(itemId);
    try {
      const res = await axios.post(
        `${API_BASE}/characters/${selectedChar.id}/items/${itemId}/use`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const payload = res.data?.character ? res.data.character : res.data;
      setSelectedChar(payload);

      // Подбираем эффект: лечение → зелёный пульс, урон → красная вспышка
      const hpAfter = payload?.hp ?? hpBefore;
      if (hpAfter > hpBefore) healPulse();
      else if (hpAfter < hpBefore) damageFlash(0.6);
      else if (itemBefore?.effect_type === 'cursed') darkPortal();

      const log = res.data?.effect_log;
      if (log) alert(log);
      await loadInventory(selectedChar.id);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Ошибка использования предмета');
    } finally {
      setUsingItemId(null);
    }
  };

  const handleDropItem = async (itemId: number) => {
    if (!selectedChar) return;
    if (!confirm('Выкинуть предмет?')) return;
    try {
      await axios.delete(`${API_BASE}/characters/${selectedChar.id}/items/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInventory((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      alert('Ошибка удаления предмета');
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const loadPageData = async () => {
      setIsLoading(true);
      try {
        const charsResponse = await axios.get(`${API_BASE}/characters/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const rawChars = charsResponse.data;
        const chars: Character[] = Array.isArray(rawChars) ? rawChars : (Array.isArray(rawChars?.items) ? rawChars.items : []);

        if (chars.length === 0) {
          navigate('/character/create');
          return;
        }

        setCharacters(chars);

        let charToLoad = chars[0];
        if (urlCharacterId) {
          const foundChar = chars.find(c => c.id === parseInt(urlCharacterId));
          if (foundChar) {
            charToLoad = foundChar;
          }
        }
        
        setSelectedChar(charToLoad);

        const [storyResponse] = await Promise.all([
          axios.get(`${API_BASE}/stories/${charToLoad.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          loadInventory(charToLoad.id),
        ]);
        setStory(storyResponse.data);

      } catch (err: unknown) {
        const error = err as AxiosError;
        console.error('Failed to load page:', error.response?.data || error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadPageData();
  }, [token, urlCharacterId, navigate]);

  const handleGenerateWithRetry = async (attempt = 0, overrideInput?: string) => {
    if (isGenerating || !selectedChar) return;
    const actionText = resolveInputToAction(overrideInput ?? input);
    if (!actionText) return;

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const res = await axios.post(
        `${API_BASE}/characters/generate`,
        { input: actionText, mode, characterId: selectedChar.id },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000
        }
      );

      if (res.data.game_over) {
        damageFlash(1.0);
        darkPortal();
        setSelectedChar(prev => prev ? { ...prev, is_alive: false, hp: 0 } : null);
        alert(`💀 ИГРА ОКОНЧЕНА! ${res.data.text}`);
        setIsGenerating(false);
        return;
      }

      const prevHp = selectedChar.hp;
      const newHp = res.data.hp;
      if (res.data.leveled_up) levelUpEffect();
      else if (newHp < prevHp) damageFlash(Math.min(1, (prevHp - newHp) / 15));
      else if (newHp > prevHp) healPulse();

      setSelectedChar(prev => prev ? {
        ...prev,
        hp: res.data.hp,
        level: res.data.level ?? prev.level,
        xp: res.data.xp ?? prev.xp,
        status_poison: res.data.status_poison ?? prev.status_poison,
        status_bleeding: res.data.status_bleeding ?? prev.status_bleeding,
        status_berserk: res.data.status_berserk ?? prev.status_berserk,
      } : null);

      const tempId = Date.now();
      const newEntry: StoryEntry = {
        id: tempId,
        character_id: selectedChar.id,
        user_input: actionText,
        ai_response: res.data.text,
        image_url: null,
        timestamp: new Date().toISOString()
      };

      setStory(prev => [...prev, newEntry]);
      setHints(Array.isArray(res.data.hints) ? res.data.hints.slice(0, 3) : []);
      setInput('');
      setRetryCount(0);
      setIsGenerating(false);
      await loadInventory(selectedChar.id);

      // Картинка генерируется в фоне — подхватываем через 8с и 20с
      const charId = selectedChar.id;
      const pollImage = async () => {
        try {
          const r = await axios.get(`${API_BASE}/stories/${charId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const entries: StoryEntry[] = r.data;
          const last = entries.at(-1);
          if (last?.image_url) {
            setStory(entries);
          }
        } catch { /* ignore */ }
      };
      setTimeout(pollImage, 8000);
      setTimeout(pollImage, 20000);

    } catch (err: any) {
      const error = err as AxiosError;
      const errMsg = (error.response?.data as any)?.detail || error.message;

      const isRetriable = 
        error.code === 'ECONNABORTED' || 
        [429, 503, 504].includes(error.response?.status || 0);

      if (isRetriable && attempt < 3) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`⏳ Retry attempt ${attempt + 1}/3 in ${delay}ms...`);
        setGenerationError(`⏳ Бабка занята... повторяю попытку ${attempt + 1}/3...`);
        
        setTimeout(() => {
          setRetryCount(attempt + 1);
          handleGenerateWithRetry(attempt + 1);
        }, delay);
        return;
      }

      if (error.code === 'ECONNABORTED') {
        setGenerationError('⏰ Слишком долго ждали. Попробуй ещё раз или упрости запрос.');
      } else if (error.response?.status === 400) {
        setGenerationError('⚠️ Персонаж мёртв или некорректный запрос.');
      } else if (error.response?.status === 403) {
        setGenerationError('🔒 Нет доступа к этому персонажу.');
      } else if (error.response?.status === 404) {
        setGenerationError('👻 Персонаж не найден.');
      } else if (error.response?.status === 500) {
        setGenerationError('💀 Сервер упал. Попробуй позже или перезапусти бэкенд.');
      } else {
        setGenerationError(`❌ Ошибка: ${errMsg}`);
      }

      setIsGenerating(false);
      console.error('Generation failed:', errMsg);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-5xl font-black text-purple-500 animate-pulse">ЗАГРУЗКА...</p>
      </div>
    );
  }

  if (!selectedChar?.is_alive) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center p-4">
        <div className="text-center max-w-2xl">
          <h1 className="text-6xl font-black mb-4">☠️ GAME OVER ☠️</h1>
          <p className="text-2xl mb-8">
            {selectedChar?.name} пал в бою. Создай нового героя, чтобы продолжить приключение.
          </p>
          <button
            onClick={() => navigate('/character/create')}
            className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-xl text-xl font-bold transition"
          >
            ✨ Создать нового героя
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-8 pb-16">
      <h2 className="text-4xl md:text-5xl font-black mb-12 text-center max-w-3xl">
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 drop-shadow-2xl">
          Твоя История
        </span>
      </h2>

      <div className="w-full max-w-4xl px-4 space-y-8">
        
        {characters.length > 1 && (
          <div className="mb-8">
            <select
              value={selectedChar?.id || ''}
              onChange={e => {
                navigate(`/story/${e.target.value}`);
              }}
              className="w-full p-4 bg-gray-800 rounded-xl border-4 border-purple-500 text-lg font-bold text-white focus:border-pink-500 transition"
            >
              {characters.map(char => (
                <option key={char.id} value={char.id}>
                  {char.name} ({char.race}) — HP: {char.hp} {!char.is_alive && '☠️'}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="bg-purple-900/20 backdrop-blur-xl p-6 rounded-3xl border-4 border-purple-600 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-4 text-xl font-black">
            <span className="text-cyan-400">❤️ HP: {selectedChar?.hp}</span>
            <span className="text-yellow-400">⚔️ Сила: {selectedChar?.strength}</span>
            <span className="text-green-400">🏃 Ловкость: {selectedChar?.dexterity}</span>
            <span className="text-yellow-300">⭐ Ур. {selectedChar?.level ?? 1}</span>
          </div>

          {/* XP bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1 font-bold">
              <span>Опыт</span>
              <span>{selectedChar?.xp ?? 0} / {xpThreshold(selectedChar?.level ?? 1)}</span>
            </div>
            <div className="w-full h-3 bg-black/50 rounded-full overflow-hidden border border-purple-500/40">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 transition-all"
                style={{
                  width: `${Math.min(100, ((selectedChar?.xp ?? 0) / xpThreshold(selectedChar?.level ?? 1)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Компаньон */}
          {selectedChar?.companion && (
            <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${
              selectedChar.companion.is_alive
                ? 'bg-indigo-900/30 border-indigo-500/50'
                : 'bg-gray-900/40 border-gray-600/40 opacity-70'
            }`}>
              <span className="text-2xl">
                {selectedChar.companion.kind === 'wolf' ? '🐺' : selectedChar.companion.kind === 'skeleton' ? '💀' : '👻'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{selectedChar.companion.name}</div>
                <div className="text-xs text-gray-400">
                  {selectedChar.companion.is_alive
                    ? `HP: ${selectedChar.companion.hp} · +d20 в бою`
                    : '💀 Пал в бою'}
                </div>
              </div>
            </div>
          )}

          {/* Статус-эффекты */}
          {(!!(selectedChar?.status_poison) || !!(selectedChar?.status_bleeding) || !!(selectedChar?.status_berserk)) && (
            <div className="flex flex-wrap gap-2 text-sm font-bold">
              {!!selectedChar?.status_poison && (
                <span className="px-3 py-1 rounded-full bg-green-900/40 border border-green-500/50 text-green-300">
                  ☠️ Яд ({selectedChar.status_poison})
                </span>
              )}
              {!!selectedChar?.status_bleeding && (
                <span className="px-3 py-1 rounded-full bg-red-900/40 border border-red-500/50 text-red-300">
                  🩸 Кровотечение ({selectedChar.status_bleeding})
                </span>
              )}
              {!!selectedChar?.status_berserk && (
                <span className="px-3 py-1 rounded-full bg-orange-900/40 border border-orange-500/50 text-orange-300">
                  🔥 Берсерк ({selectedChar.status_berserk})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Инвентарь */}
        <div className="bg-black/60 backdrop-blur-xl p-6 rounded-3xl border-4 border-purple-600 shadow-2xl">
          <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-400 mb-3">
            🎒 Инвентарь ({inventory.length})
          </h3>
          {inventory.length === 0 ? (
            <p className="text-gray-400 italic">Пока пусто — ищи предметы в приключении</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {inventory.map((item) => {
                const meta = effectLabel[item.effect_type] || effectLabel.none;
                return (
                  <div key={item.id} className={`p-3 rounded-xl border-2 ${meta.color}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold truncate">{meta.icon} {item.name}</div>
                        <div className="text-xs opacity-80">
                          {formatItemEffect(item.effect_type, item.effect_value)}
                        </div>
                        {item.description && (
                          <div className="text-xs text-gray-400 italic mt-1 line-clamp-2">{item.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleUseItem(item.id)}
                        disabled={usingItemId === item.id || item.effect_type === 'none'}
                        className="flex-1 px-3 py-1 text-sm font-bold bg-purple-600/50 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition"
                      >
                        {usingItemId === item.id ? '⏳' : '✨ Использовать'}
                      </button>
                      <button
                        onClick={() => handleDropItem(item.id)}
                        className="px-3 py-1 text-sm bg-red-900/40 hover:bg-red-900/70 border border-red-500/40 rounded-lg transition"
                        title="Выкинуть"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div ref={storyContainerRef} className="bg-black/60 backdrop-blur-xl p-5 rounded-3xl min-h-[320px] max-h-[48vh] overflow-y-auto scrollbar-hide border-4 border-purple-600 shadow-2xl">
          {story.length === 0 ? (
            <p className="text-2xl text-gray-400 text-center font-bold">Начни приключение, нищеброд...</p>
          ) : (
            story.map((entry) => (
              <div key={entry.id} className="mb-6 p-5 bg-purple-900/30 rounded-2xl border-2 border-purple-500">
                <p className="text-base font-bold text-cyan-400 mb-2">ТЫ: {entry.user_input}</p>
                <p className="text-lg text-white leading-relaxed">{entry.ai_response}</p>
                {entry.image_url && (
                  <div className="mt-4 flex justify-center">
                    <img
                      src={entry.image_url}
                      alt="Сцена"
                      onLoad={scrollStoryToBottom}
                      className="max-w-full max-h-60 rounded-2xl border-4 border-pink-600 shadow-2xl"
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {generationError && (
          <div className={`p-4 rounded-xl border-2 text-center font-bold ${
            generationError.includes('⏳') 
              ? 'bg-yellow-900/20 border-yellow-500 text-yellow-300'
              : 'bg-red-900/20 border-red-500 text-red-300'
          }`}>
            {generationError}
            {!isGenerating && !generationError.includes('⏳') && (
              <button
                onClick={() => {
                  setGenerationError(null);
                  handleGenerateWithRetry(0);
                }}
                className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
              >
                🔄 Попробовать снова
              </button>
            )}
          </div>
        )}

        <div className="space-y-4">
          {/* Подсказки A/Б/В */}
          {hints.length > 0 && (
            <div className="bg-gray-900/50 border-2 border-purple-500/40 rounded-2xl p-5">
              <div className="text-base text-gray-300 font-bold mb-3">
                💡 Варианты (нажми кнопку или введи букву в чат):
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {hints.map((hint, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleGenerateWithRetry(0, hint)}
                    disabled={isGenerating}
                    className="text-left px-4 py-3 rounded-xl border-2 border-purple-500/40 bg-gradient-to-br from-purple-900/40 to-pink-900/30 hover:from-purple-800/60 hover:to-pink-800/50 hover:border-pink-500/60 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <div className="font-black text-pink-300 text-base mb-0.5">[{HINT_LETTERS[idx]}]</div>
                    <div className="text-white text-base leading-snug">{hint}</div>
                  </button>
                ))}
              </div>
              <div className="text-sm text-gray-500 mt-2 italic">
                Свой вариант - просто напиши в чат, опиши действие.
              </div>
            </div>
          )}

          <select
            value={mode}
            onChange={e => setMode(e.target.value)}
            className="w-full p-3 bg-gray-800 rounded-xl border-4 border-purple-500 text-base font-bold text-white"
          >
            <option value="dark">ТЁМНЫЙ УЖАС</option>
            <option value="epic">ЭПИЧНЫЙ МРАК</option>
          </select>

          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerateWithRetry()}
            placeholder={hints.length > 0 ? "Напиши А/Б/В для подсказки или свой вариант..." : "Что ты сделаешь, герой?"}
            className="w-full p-4 bg-gray-800 rounded-xl border-4 border-purple-500 text-lg text-white placeholder-gray-400 focus:border-pink-500 transition"
            disabled={isGenerating}
          />

          <button
            onClick={() => handleGenerateWithRetry()}
            disabled={isGenerating || !input.trim()}
            className="w-full py-4 text-xl font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 shadow-2xl transform hover:scale-105 transition-all duration-300"
          >
            {isGenerating ? `БАБКА ДУМАЕТ... (попытка ${retryCount + 1})` : 'В БОЙ!'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryPage;
