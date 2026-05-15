import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios, { AxiosError } from 'axios';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AuthContext } from '../App';
import { AuthContextType, Character } from '../types';
import RatingBar from './RatingBar';

const API_BASE = import.meta.env.VITE_API_BASE;

interface StoryEntry {
  id: number;
  character_id: number;
  user_input: string;
  ai_response: string;
  image_url: string | null;
  timestamp: string;
  likes?: number;
  skulls?: number;
  fires?: number;
  my_rating?: 'like' | 'skull' | 'fire' | null;
}

interface CharacterWithStories {
  character: Character;
  stories: StoryEntry[];
}

const RACES = [
  { value: 'human',      label: 'Человек' },
  { value: 'elf',        label: 'Эльф' },
  { value: 'orc',        label: 'Орк' },
  { value: 'dwarf',      label: 'Дворф' },
  { value: 'skeleton',   label: 'Скелет' },
  { value: 'vampire',    label: 'Вампир' },
  { value: 'demon',      label: 'Демон' },
  { value: 'wraith',     label: 'Призрак' },
  { value: 'dragonborn', label: 'Драконорождённый' },
];

const WEAPONS = [
  { value: 'sword',    label: 'Меч' },
  { value: 'staff',    label: 'Посох' },
  { value: 'dagger',   label: 'Кинжал' },
  { value: 'axe',      label: 'Топор' },
  { value: 'bow',      label: 'Лук' },
  { value: 'scythe',   label: 'Коса' },
  { value: 'flail',    label: 'Цеп' },
  { value: 'crossbow', label: 'Арбалет' },
  { value: 'claws',    label: 'Когти' },
];

interface CharacterStats {
  character_id: number;
  name: string;
  level: number;
  xp: number;
  is_alive: boolean;
  total_turns: number;
  items_used: number;
  items_in_bag: number;
  items_by_effect: Record<string, number>;
  created_at: string | null;
}

const CLASS_LABELS: Record<string, string> = {
  warrior: '🛡️ Воин', berserker: '🔥 Берсерк',
  rogue: '🗡️ Разбойник', necromancer: '💀 Некромант',
};

const RACE_ICONS: Record<string, string> = {
  human: '🧑', elf: '🧝', orc: '👹', dwarf: '⛏️', skeleton: '💀',
  vampire: '🧛', demon: '😈', wraith: '👻', dragonborn: '🐉',
};

const ArchivePage: React.FC = () => {
  const { token } = useContext(AuthContext) as AuthContextType;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [archiveData, setArchiveData] = useState<CharacterWithStories[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCharId, setSelectedCharId] = useState<number | null>(null);
  const [expandedStories, setExpandedStories] = useState<Set<number>>(new Set());
  const [charStats, setCharStats] = useState<CharacterStats | null>(null);
  const [achievements, setAchievements] = useState<Array<{code: string; title: string; description: string; icon: string; unlocked: boolean}>>([]);

  // Фильтры
  const [search, setSearch]   = useState(() => searchParams.get('search') ?? '');
  const [race, setRace]       = useState(() => searchParams.get('race') ?? '');
  const [weapon, setWeapon]   = useState(() => searchParams.get('weapon') ?? '');
  const [aliveFilter, setAliveFilter] = useState(() => searchParams.get('alive') ?? '');
  const [sortBy, setSortBy]   = useState(() => searchParams.get('sort_by') ?? 'id');
  const [order, setOrder]     = useState(() => searchParams.get('order') ?? 'desc');
  const [page, setPage]       = useState(() => Math.max(1, Number(searchParams.get('page') ?? 1)));
  const [total, setTotal]     = useState(0);
  const limit = 5;

  // Подгрузка детальной статистики и бейджей выбранного персонажа
  useEffect(() => {
    if (!token || selectedCharId == null) {
      setCharStats(null);
      setAchievements([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [statsRes, achRes] = await Promise.all([
          axios.get(`${API_BASE}/characters/${selectedCharId}/stats`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_BASE}/characters/${selectedCharId}/achievements`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (!cancelled) {
          setCharStats(statsRes.data);
          setAchievements(achRes.data || []);
        }
      } catch {
        if (!cancelled) {
          setCharStats(null);
          setAchievements([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCharId, token]);

  // Синхронизация URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (search)      next.set('search', search);
    if (race)        next.set('race', race);
    if (weapon)      next.set('weapon', weapon);
    if (aliveFilter) next.set('alive', aliveFilter);
    if (sortBy !== 'id')   next.set('sort_by', sortBy);
    if (order !== 'desc')  next.set('order', order);
    if (page !== 1)        next.set('page', String(page));
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, race, weapon, aliveFilter, sortBy, order, page]);

  // Загрузка данных — sortBy и order ВКЛЮЧЕНЫ в зависимости
  useEffect(() => {
    if (!token) { navigate('/login'); return; }

    const loadArchive = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const charsResponse = await axios.get(`${API_BASE}/characters/`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            skip: (page - 1) * limit,
            limit,
            search: search || undefined,
            race: race || undefined,
            sort_by: sortBy,
            order,
          },
        });

        const characters: Character[] = charsResponse.data.items ?? [];
        setTotal(charsResponse.data.total ?? 0);

        if (characters.length === 0) {
          setArchiveData([]);
          setIsLoading(false);
          return;
        }

        const results = await Promise.all(
          characters.map(async (char) => {
            try {
              const res = await axios.get(`${API_BASE}/stories/${char.id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              return { character: char, stories: res.data as StoryEntry[] };
            } catch {
              return { character: char, stories: [] };
            }
          }),
        );

        // Фильтр только с историями
        const withStories = results.filter(r => r.stories.length > 0);
        setArchiveData(withStories);

        // Авто-выбор первого; сбрасываем если его нет в новом списке
        setSelectedCharId(prev => {
          if (prev && withStories.some(r => r.character.id === prev)) return prev;
          return withStories[0]?.character.id ?? null;
        });
      } catch (err: unknown) {
        const e = err as AxiosError;
        setError(`Ошибка загрузки архива: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    const tid = setTimeout(loadArchive, 400);
    return () => clearTimeout(tid);
  // ВАЖНО: sortBy и order тоже перезапускают запрос
  }, [token, navigate, page, search, race, sortBy, order]);

  // Клиентская фильтрация по оружию и is_alive (бэк не поддерживает weapon/alive-фильтр)
  const displayData = useMemo(() => {
    return archiveData.filter(({ character }) => {
      if (weapon && character.weapon !== weapon) return false;
      if (aliveFilter === 'alive' && !character.is_alive) return false;
      if (aliveFilter === 'dead' && character.is_alive) return false;
      return true;
    });
  }, [archiveData, weapon, aliveFilter]);

  const toggleStory = (id: number) => {
    setExpandedStories(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const resetFilters = () => {
    setSearch(''); setRace(''); setWeapon(''); setAliveFilter('');
    setSortBy('id'); setOrder('desc'); setPage(1);
  };

  const totalPages = Math.ceil(total / limit);
  const selectedData = displayData.find(r => r.character.id === selectedCharId);

  const exportStoryAsTxt = (data: CharacterWithStories) => {
    const c = data.character;
    const header = [
      `История персонажа: ${c.name}`,
      `Раса: ${c.race} · Оружие: ${c.weapon} · Класс: ${c.character_class || 'warrior'}`,
      `HP ${c.hp} · STR ${c.strength} · DEX ${c.dexterity} · Уровень ${c.level ?? 1}`,
      `Статус: ${c.is_alive ? 'жив' : 'мёртв'}`,
      c.created_at ? `Создан: ${new Date(c.created_at).toLocaleString('ru-RU')}` : '',
      '',
      '═══════════════════════════════════════',
      '',
    ].filter(Boolean).join('\n');
    const body = data.stories
      .map((s, i) => {
        const time = new Date(s.timestamp).toLocaleString('ru-RU');
        return [
          `── Ход ${i + 1} · ${time} ──`,
          `[Игрок] ${s.user_input}`,
          '',
          `[Мастер] ${s.ai_response}`,
          '',
        ].join('\n');
      })
      .join('\n');
    const content = header + body;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${c.name.replace(/[^a-zа-я0-9_-]/gi, '_')}_история.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen pt-8 pb-16 px-4">
      <h1 className="text-5xl font-black text-center mb-8">
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400">
          📜 Архив Историй
        </span>
      </h1>

      {/* Панель фильтров */}
      <div className="max-w-7xl mx-auto mb-6 bg-gray-900/80 p-5 rounded-2xl border border-purple-500/30 shadow-lg space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Поиск */}
          <input
            type="text"
            placeholder="🔍 Поиск по имени..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none flex-1 min-w-[160px]"
          />

          {/* Раса */}
          <select
            value={race}
            onChange={e => { setRace(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none"
          >
            <option value="">🌍 Все расы</option>
            {RACES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>

          {/* Оружие */}
          <select
            value={weapon}
            onChange={e => { setWeapon(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none"
          >
            <option value="">🗡️ Всё оружие</option>
            {WEAPONS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>

          {/* Статус жизни */}
          <select
            value={aliveFilter}
            onChange={e => { setAliveFilter(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none"
          >
            <option value="">💫 Все</option>
            <option value="alive">❤️ Живые</option>
            <option value="dead">💀 Мёртвые</option>
          </select>

          {/* Сортировка */}
          <select
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none"
          >
            <option value="id">🆔 По ID</option>
            <option value="name">🔤 По имени</option>
            <option value="race">🌍 По расе</option>
            <option value="hp">❤️ По HP</option>
            <option value="strength">💪 По силе</option>
            <option value="dexterity">🏃 По ловкости</option>
            <option value="level">⭐ По уровню</option>
            <option value="created_at">📅 По дате</option>
          </select>

          {/* Порядок */}
          <button
            onClick={() => { setOrder(o => o === 'asc' ? 'desc' : 'asc'); setPage(1); }}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-white font-bold transition"
            title={order === 'asc' ? 'По возрастанию' : 'По убыванию'}
          >
            {order === 'asc' ? '⬆️ Возр.' : '⬇️ Убыв.'}
          </button>

          {/* Сброс */}
          <button
            onClick={resetFilters}
            className="px-4 py-2 bg-purple-600/50 hover:bg-purple-600 rounded-lg text-white font-bold transition"
          >
            ✖ Сброс
          </button>
        </div>

        {/* Пагинация */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-1 border-t border-gray-700/50">
          <span className="text-purple-300 font-bold text-sm">
            Страница {page} из {totalPages || 1} (Всего: {total})
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 bg-purple-600/50 hover:bg-purple-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg font-bold transition text-white text-sm"
            >
              ← Назад
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 bg-purple-600/50 hover:bg-purple-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg font-bold transition text-white text-sm"
            >
              Вперёд →
            </button>
          </div>
        </div>
      </div>

      {/* Контент */}
      {isLoading ? (
        <div className="text-center text-2xl text-purple-400 animate-pulse py-20">⏳ Загрузка...</div>
      ) : error ? (
        <div className="text-center text-red-400 font-bold bg-red-900/20 p-4 rounded-xl max-w-2xl mx-auto">{error}</div>
      ) : displayData.length === 0 ? (
        <div className="text-center text-gray-500 text-xl py-20">📭 Ничего не найдено по вашим фильтрам.</div>
      ) : (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Список персонажей */}
          <div className="lg:col-span-1">
            <div className="bg-black/60 backdrop-blur-xl rounded-3xl p-5 border-4 border-purple-600 sticky top-8 max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-purple-300 mb-4">
                ⚔️ Персонажи ({displayData.length})
              </h2>
              <div className="space-y-2">
                {displayData.map(({ character, stories }) => {
                  const active = selectedCharId === character.id;
                  return (
                    <button
                      key={character.id}
                      onClick={() => setSelectedCharId(character.id)}
                      className={`w-full p-3 rounded-xl text-left transition border-2 ${
                        active
                          ? 'bg-purple-600 border-pink-500 text-white shadow-lg shadow-purple-500/20'
                          : 'bg-gray-800/50 border-transparent text-gray-300 hover:bg-gray-700 hover:border-purple-500/40'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold">
                          {RACE_ICONS[character.race] || '⚔️'} {character.name}
                        </span>
                        <span className="text-xs opacity-70">{stories.length} зап.</span>
                      </div>
                      <div className="text-xs mt-1 opacity-75 flex flex-wrap gap-1">
                        <span>{character.race}</span>
                        <span>·</span>
                        <span>HP: {character.hp}</span>
                        {character.level && character.level > 1 && (
                          <><span>·</span><span>⭐ Ур.{character.level}</span></>
                        )}
                        {character.character_class && character.character_class !== 'warrior' && (
                          <><span>·</span><span>{CLASS_LABELS[character.character_class]}</span></>
                        )}
                      </div>
                      {!character.is_alive && (
                        <div className="text-xs text-red-400 font-bold mt-1">💀 Мёртв</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Истории */}
          <div className="lg:col-span-2">
            {selectedData ? (
              <div className="space-y-5">
                {/* Карточка персонажа */}
                <div className="bg-black/60 backdrop-blur-xl rounded-3xl p-5 border-4 border-purple-600">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-2xl font-black text-purple-300 mb-1">
                        {RACE_ICONS[selectedData.character.race] || '⚔️'} {selectedData.character.name}
                      </h2>
                      <p className="text-gray-400 text-sm">
                        {selectedData.character.race} · {selectedData.character.weapon} · HP: {selectedData.character.hp}
                        {selectedData.character.level && selectedData.character.level > 1
                          ? ` · ⭐ Ур.${selectedData.character.level}`
                          : ''}
                        {selectedData.character.character_class
                          ? ` · ${CLASS_LABELS[selectedData.character.character_class] || selectedData.character.character_class}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex gap-2 text-sm font-bold">
                      <span className={`px-3 py-1 rounded-full border ${
                        selectedData.character.is_alive
                          ? 'text-green-300 border-green-500/40 bg-green-900/30'
                          : 'text-red-400 border-red-500/40 bg-red-900/30'
                      }`}>
                        {selectedData.character.is_alive ? '❤️ Жив' : '💀 Мёртв'}
                      </span>
                      {selectedData.character.is_alive && (
                        <Link
                          to={`/story/${selectedData.character.id}`}
                          className="px-3 py-1 rounded-full border border-pink-500/60 bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition"
                        >
                          {selectedData.stories.length > 0 ? '📜 Продолжить путь' : '🎮 Играть'}
                        </Link>
                      )}
                      {selectedData.stories.length > 0 && (
                        <button
                          onClick={() => exportStoryAsTxt(selectedData)}
                          className="px-3 py-1 rounded-full border border-cyan-500/60 bg-cyan-900/30 text-cyan-200 hover:bg-cyan-700/40 transition"
                          title="Скачать историю в .txt"
                        >
                          💾 .txt
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Мини-статы */}
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                    <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-2">
                      <div className="text-red-400 font-bold">❤️ {selectedData.character.hp}</div>
                      <div className="text-gray-500">HP</div>
                    </div>
                    <div className="bg-orange-900/30 border border-orange-500/30 rounded-lg p-2">
                      <div className="text-orange-400 font-bold">💪 {selectedData.character.strength}</div>
                      <div className="text-gray-500">Сила</div>
                    </div>
                    <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-2">
                      <div className="text-blue-400 font-bold">🏃 {selectedData.character.dexterity}</div>
                      <div className="text-gray-500">Ловкость</div>
                    </div>
                  </div>

                  {selectedData.character.created_at && (
                    <div className="text-xs text-gray-500 mt-2">
                      📅 Создан: {new Date(selectedData.character.created_at).toLocaleString('ru-RU')}
                    </div>
                  )}

                  {charStats && (
                    <div className="mt-3 p-3 bg-purple-950/30 rounded-xl border border-purple-500/30">
                      <div className="text-xs text-purple-300 font-bold mb-2">📊 Статистика похода</div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-black/40 rounded-lg p-2">
                          <div className="text-yellow-400 font-bold">{charStats.total_turns}</div>
                          <div className="text-gray-500">Ходов</div>
                        </div>
                        <div className="bg-black/40 rounded-lg p-2">
                          <div className="text-green-400 font-bold">{charStats.items_used}</div>
                          <div className="text-gray-500">Использовано</div>
                        </div>
                        <div className="bg-black/40 rounded-lg p-2">
                          <div className="text-cyan-400 font-bold">{charStats.items_in_bag}</div>
                          <div className="text-gray-500">В рюкзаке</div>
                        </div>
                      </div>
                      {Object.keys(charStats.items_by_effect).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 text-[10px]">
                          {Object.entries(charStats.items_by_effect).map(([etype, cnt]) => (
                            <span key={etype} className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-white/10">
                              {etype}: {cnt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {achievements.length > 0 && (
                    <div className="mt-3 p-3 bg-gradient-to-br from-yellow-900/20 to-purple-950/30 rounded-xl border border-yellow-500/30">
                      <div className="text-xs text-yellow-200 font-bold mb-2">
                        🏅 Достижения ({achievements.filter((a) => a.unlocked).length}/{achievements.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {achievements.map((a) => (
                          <div
                            key={a.code}
                            title={`${a.title} — ${a.description}`}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-bold transition ${
                              a.unlocked
                                ? 'bg-yellow-600/20 border-yellow-400/60 text-yellow-200'
                                : 'bg-gray-900/40 border-gray-700/50 text-gray-600 grayscale opacity-60'
                            }`}
                          >
                            <span className="text-base leading-none">{a.icon}</span>
                            <span>{a.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Записи историй */}
                {selectedData.stories.map((story) => {
                  const isExpanded = expandedStories.has(story.id);
                  return (
                    <div
                      key={story.id}
                      className="bg-black/60 backdrop-blur-xl rounded-3xl p-5 border-2 border-purple-500 hover:border-pink-500 transition"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <p className="text-xs text-gray-400">
                          🕐 {new Date(story.timestamp).toLocaleString('ru-RU')}
                        </p>
                        <button
                          onClick={() => toggleStory(story.id)}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs font-bold transition"
                        >
                          {isExpanded ? '▲ Свернуть' : '▼ Развернуть'}
                        </button>
                      </div>

                      <div className="bg-purple-900/30 p-3 rounded-xl border-l-4 border-cyan-500">
                        <p className="text-xs text-cyan-400 font-bold mb-1">ТЫ:</p>
                        <p className="text-white">{story.user_input}</p>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 space-y-3">
                          <div className="bg-pink-900/30 p-3 rounded-xl border-l-4 border-pink-500">
                            <p className="text-xs text-pink-400 font-bold mb-1">ИСТОРИЯ:</p>
                            <p className="text-white leading-relaxed">{story.ai_response}</p>
                          </div>
                          {story.image_url && (
                            <div className="flex justify-center">
                              <img
                                src={story.image_url}
                                alt="Сцена"
                                className="max-w-full max-h-80 rounded-2xl border-4 border-pink-600 shadow-2xl"
                              />
                            </div>
                          )}
                          <RatingBar
                            messageId={story.id}
                            initialLikes={story.likes ?? 0}
                            initialSkulls={story.skulls ?? 0}
                            initialFires={story.fires ?? 0}
                            initialMyRating={story.my_rating ?? null}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-500 text-xl py-20">
                👈 Выбери персонажа из списка слева
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchivePage;
