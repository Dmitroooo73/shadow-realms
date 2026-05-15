import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../App';
import { AuthContextType, Character } from '../types';
import CharacterAvatarUpload from './CharacterAvatarUpload';

const API_BASE = import.meta.env.VITE_API_BASE;

const Profile: React.FC = () => {
  const auth = useContext(AuthContext);

  if (!auth) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">❌ Ошибка контекста</div>;
  }

  const { user, token, setUser } = auth as AuthContextType;
  const navigate = useNavigate();
  const location = useLocation();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [raceFilter, setRaceFilter] = useState('');
  const [weaponFilter, setWeaponFilter] = useState('');
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'hp' | 'strength' | 'dexterity' | 'created_at' | 'level'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const userAvatarInput = useRef<HTMLInputElement>(null);

  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  // Инвентарь
  const [inventoryOpen, setInventoryOpen] = useState<number | null>(null);
  const [charItems, setCharItems] = useState<Record<number, import('../types').InventoryItem[]>>({});
  const [itemsLoading, setItemsLoading] = useState<number | null>(null);

  // Достижения
  const [achOpen, setAchOpen] = useState<number | null>(null);
  const [charAch, setCharAch] = useState<Record<number, Array<{code: string; title: string; description: string; icon: string; unlocked: boolean}>>>({});
  const [achLoading, setAchLoading] = useState<number | null>(null);

  // Смена пароля
  const [pwOpen, setPwOpen] = useState(false);
  const [pwOld, setPwOld] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwNew2, setPwNew2] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ok: boolean; text: string} | null>(null);

  const toggleInventory = async (charId: number) => {
    if (inventoryOpen === charId) { setInventoryOpen(null); return; }
    setInventoryOpen(charId);
    if (charItems[charId]) return;
    setItemsLoading(charId);
    try {
      const res = await axios.get(`${API_BASE}/characters/${charId}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCharItems((prev) => ({ ...prev, [charId]: res.data ?? [] }));
    } catch {
      setCharItems((prev) => ({ ...prev, [charId]: [] }));
    } finally {
      setItemsLoading(null);
    }
  };

  const toggleAchievements = async (charId: number) => {
    if (achOpen === charId) { setAchOpen(null); return; }
    setAchOpen(charId);
    if (charAch[charId]) return;
    setAchLoading(charId);
    try {
      const res = await axios.get(`${API_BASE}/characters/${charId}/achievements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCharAch((prev) => ({ ...prev, [charId]: res.data ?? [] }));
    } catch {
      setCharAch((prev) => ({ ...prev, [charId]: [] }));
    } finally {
      setAchLoading(null);
    }
  };

  const submitChangePassword = async () => {
    setPwMsg(null);
    if (!pwOld || !pwNew || !pwNew2) { setPwMsg({ok:false, text:'Заполни все поля'}); return; }
    if (pwNew !== pwNew2) { setPwMsg({ok:false, text:'Новые пароли не совпадают'}); return; }
    if (pwNew.length < 8) { setPwMsg({ok:false, text:'Минимум 8 символов'}); return; }
    setPwSaving(true);
    try {
      await axios.post(`${API_BASE}/auth/change-password`,
        { old_password: pwOld, new_password: pwNew },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setPwMsg({ok:true, text:'✅ Пароль успешно изменён'});
      setPwOld(''); setPwNew(''); setPwNew2('');
    } catch (err: any) {
      setPwMsg({ok:false, text: err?.response?.data?.detail || 'Ошибка смены пароля'});
    } finally {
      setPwSaving(false);
    }
  };

  const EFFECT_ICONS: Record<string, string> = {
    heal: '💚', damage: '💥', berserk: '🔥', stat_boost: '💪',
    cursed: '💀', cure_poison: '🩹', mystery: '🌀', none: '📦',
  };

  const EFFECT_UNITS: Record<string, string> = {
    heal: 'HP', damage: 'HP', berserk: 'ходов', stat_boost: 'к статам',
    cursed: 'HP', cure_poison: '', mystery: '', none: '',
  };

  const formatEffect = (etype: string, val: number): string => {
    if (!val) return '';
    const unit = EFFECT_UNITS[etype] ?? '';
    if (etype === 'damage' || etype === 'cursed') return `−${val} ${unit}`;
    if (etype === 'heal') return `+${val} ${unit}`;
    if (etype === 'stat_boost') return `+${val} ${unit}`;
    if (etype === 'berserk') return `${val} ${unit}`;
    return `+${val}`;
  };

  const loadCharacters = async (opts?: { sort_by?: string; order?: string }) => {
    try {
      const params = new URLSearchParams();
      params.set('sort_by', opts?.sort_by ?? sortBy);
      params.set('order', opts?.order ?? sortOrder);
      params.set('limit', '100');
      const res = await axios.get(`${API_BASE}/characters/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const raw = res.data;
      const items: Character[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
        ? raw.items
        : [];
      setCharacters(items);
    } catch (err) {
      console.error('❌ Failed to load characters:', err);
      setCharacters([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadCharacters();
    // Инициализация аватарки пользователя
    if (user?.avatar_url) {
      setUserAvatarUrl(user.avatar_url);
    }
  }, [token, navigate, user?.avatar_url]);

  useEffect(() => {
    if (token) loadCharacters({ sort_by: sortBy, order: sortOrder });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder]);

  const startEditProfile = () => {
    if (!user) return;
    setEditName(user.name ?? '');
    setEditAge(user.age ?? '');
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    if (!user) return;
    if (!editName.trim()) { alert('Имя не может быть пустым'); return; }
    const ageNum = typeof editAge === 'number' ? editAge : parseInt(String(editAge), 10);
    if (!ageNum || ageNum < 13) { alert('Возраст должен быть ≥ 13'); return; }
    setSaving(true);
    try {
      const res = await axios.put(
        `${API_BASE}/users/${user.id}`,
        { name: editName.trim(), age: ageNum },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setUser?.(res.data);
      setEditingProfile(false);
    } catch {
      alert('Ошибка сохранения профиля');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (location.state?.refresh) {
      loadCharacters();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить персонажа?')) return;
    try {
      await axios.delete(`${API_BASE}/characters/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCharacters((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert('Ошибка удаления');
    }
  };

  const handleAvatarChange = (characterId: number, newUrl: string | null) => {
    setCharacters((prev) =>
      prev.map((c) =>
        c.id === characterId ? { ...c, avatar_url: newUrl, avatar_key: newUrl ? c.avatar_key : null } : c
      )
    );
  };

  const handleUserAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('Недопустимый формат, вирусы качаешь? Разрешены токо: JPEG, PNG, GIF, WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком жирный. Максимум 5 MB');
      return;
    }

    setAvatarUploading(true);
    const localPreview = URL.createObjectURL(file);
    setUserAvatarUrl(localPreview);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API_BASE}/users/me/avatar`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserAvatarUrl(res.data.avatar_url);
    } catch {
      alert('Ошибка загрузки аватара');
      setUserAvatarUrl(user?.avatar_url ?? null);
    } finally {
      setAvatarUploading(false);
      if (userAvatarInput.current) userAvatarInput.current.value = '';
    }
  };

  const handleUserAvatarDelete = async () => {
    if (!confirm('Удалить ваш ужасный аватар?')) return;
    try {
      await axios.delete(`${API_BASE}/users/me/avatar`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserAvatarUrl(null);
    } catch {
      alert('Ошибка удаления аватара');
    }
  };

  // Дарк-фентези маппинги рас и оружий
  const raceIcons: Record<string, string> = {
    human: '🧑', elf: '🧝', orc: '👹', dwarf: '⛏️', skeleton: '💀',
    vampire: '🧛', demon: '😈', wraith: '👻', dragonborn: '🐉',
  };
  const raceNames: Record<string, string> = {
    human: 'Человек', elf: 'Эльф', orc: 'Орк', dwarf: 'Дворф', skeleton: 'Скелет',
    vampire: 'Вампир', demon: 'Демон', wraith: 'Призрак', dragonborn: 'Драконорождённый',
  };
  const weaponIcons: Record<string, string> = {
    sword: '🗡️', staff: '🪄', dagger: '🔪', axe: '🪓', bow: '🏹',
    scythe: '⚰️', flail: '⛓️', crossbow: '🎯', claws: '🐺',
  };
  const weaponNames: Record<string, string> = {
    sword: 'Меч', staff: 'Посох', dagger: 'Кинжал', axe: 'Топор', bow: 'Лук',
    scythe: 'Коса', flail: 'Цеп', crossbow: 'Арбалет', claws: 'Когти',
  };
  const raceBorderColors: Record<string, string> = {
    human: 'border-blue-500/50', elf: 'border-green-500/50', orc: 'border-red-500/50',
    dwarf: 'border-amber-500/50', skeleton: 'border-gray-400/50', vampire: 'border-rose-500/50',
    demon: 'border-orange-600/50', wraith: 'border-cyan-400/50', dragonborn: 'border-yellow-500/50',
  };
  const classAccent: Record<string, { ring: string; badge: string; label: string }> = {
    warrior: { ring: 'shadow-[inset_4px_0_0_0_rgba(59,130,246,0.8)]', badge: 'bg-blue-900/40 border-blue-500/50 text-blue-300', label: '🛡️ Воин' },
    berserker: { ring: 'shadow-[inset_4px_0_0_0_rgba(239,68,68,0.9)]', badge: 'bg-red-900/40 border-red-500/50 text-red-300', label: '🔥 Берсерк' },
    rogue: { ring: 'shadow-[inset_4px_0_0_0_rgba(168,85,247,0.9)]', badge: 'bg-purple-900/40 border-purple-500/50 text-purple-300', label: '🗡️ Разбойник' },
    necromancer: { ring: 'shadow-[inset_4px_0_0_0_rgba(34,197,94,0.8)]', badge: 'bg-green-900/40 border-green-500/50 text-green-300', label: '💀 Некромант' },
  };

  const filteredCharacters = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    return characters.filter((c) => {
      const matchesSearch = !s || c.name.toLowerCase().includes(s);
      const matchesRace = !raceFilter || c.race === raceFilter;
      const matchesWeapon = !weaponFilter || c.weapon === weaponFilter;
      return matchesSearch && matchesRace && matchesWeapon;
    });
  }, [characters, raceFilter, searchTerm, weaponFilter]);

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">⏳ Загрузка...</div>;
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Профиль */}
        <div className="card bg-gray-800/90 p-8 rounded-3xl border border-purple-500/50 shadow-2xl mb-8">
          <h1 className="text-4xl font-black mb-6 gradient-text">👤 Профиль</h1>
          <div className="flex items-start gap-6">
            {/* Аватар пользователя */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative w-28 h-28 rounded-full overflow-hidden border-3 border-purple-500/70 bg-gray-700 flex items-center justify-center shadow-lg shadow-purple-500/20">
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt="Аватар"
                    className="w-full h-full object-cover"
                    onError={() => setUserAvatarUrl(null)}
                  />
                ) : (
                  <span className="text-5xl select-none">👤</span>
                )}
                {avatarUploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => userAvatarInput.current?.click()}
                  disabled={avatarUploading}
                  className="px-2 py-1 text-xs bg-purple-600/40 hover:bg-purple-600/70 text-purple-200 border border-purple-500/50 rounded-lg transition disabled:opacity-50"
                >
                  {avatarUploading ? '⏳' : '📷 Загрузить'}
                </button>
                {userAvatarUrl && (
                  <button
                    type="button"
                    onClick={handleUserAvatarDelete}
                    className="px-2 py-1 text-xs bg-red-600/30 hover:bg-red-600/60 text-red-300 border border-red-500/40 rounded-lg transition"
                  >
                    🗑️
                  </button>
                )}
              </div>
              <input
                ref={userAvatarInput}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleUserAvatarUpload}
              />
            </div>

            {/* Инфо профиля */}
            <div className="flex-1 space-y-2 text-lg text-gray-300">
              {!editingProfile ? (
                <>
                  <p><strong>📛 Имя:</strong> {user.name}</p>
                  <p><strong>🎂 Возраст:</strong> {user.age}</p>
                  <p><strong>📧 Email:</strong> {user.email}</p>
                  <p><strong>🎭 Роль:</strong> <span className="text-purple-400 font-bold">{user.role}</span></p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      onClick={startEditProfile}
                      className="px-4 py-2 bg-purple-600/50 hover:bg-purple-600 rounded-lg text-white text-base font-bold transition"
                    >
                      ✏️ Редактировать
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPwOpen((o)=>!o); setPwMsg(null); }}
                      className="px-4 py-2 bg-cyan-600/50 hover:bg-cyan-600 rounded-lg text-white text-base font-bold transition"
                    >
                      🔑 {pwOpen ? 'Закрыть смену пароля' : 'Сменить пароль'}
                    </button>
                  </div>

                  {pwOpen && (
                    <div className="mt-3 p-4 bg-gray-900/70 border border-cyan-500/30 rounded-xl space-y-2">
                      <input
                        type="password"
                        placeholder="Старый пароль"
                        value={pwOld}
                        onChange={(e) => setPwOld(e.target.value)}
                        className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 w-full text-white focus:border-cyan-500 outline-none"
                      />
                      <input
                        type="password"
                        placeholder="Новый пароль (мин. 8 символов, буквы + цифры)"
                        value={pwNew}
                        onChange={(e) => setPwNew(e.target.value)}
                        className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 w-full text-white focus:border-cyan-500 outline-none"
                      />
                      <input
                        type="password"
                        placeholder="Подтвердить новый пароль"
                        value={pwNew2}
                        onChange={(e) => setPwNew2(e.target.value)}
                        className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 w-full text-white focus:border-cyan-500 outline-none"
                      />
                      {pwMsg && (
                        <div className={`text-sm font-bold ${pwMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
                          {pwMsg.text}
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={pwSaving}
                        onClick={submitChangePassword}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 rounded-lg text-white font-bold transition disabled:opacity-50"
                      >
                        {pwSaving ? '⏳ Сохраняю...' : '💾 Сменить пароль'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">📛 Имя</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-gray-900 border border-purple-500/50 rounded-lg px-3 py-2 w-full text-white focus:border-purple-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">🎂 Возраст</label>
                    <input
                      type="number"
                      min={13}
                      value={editAge}
                      onChange={(e) => setEditAge(e.target.value === '' ? '' : Number(e.target.value))}
                      className="bg-gray-900 border border-purple-500/50 rounded-lg px-3 py-2 w-32 text-white focus:border-purple-400 outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={saveProfile}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg text-white text-sm font-bold transition disabled:opacity-50"
                    >
                      {saving ? '⏳ Сохранение...' : '💾 Сохранить'}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setEditingProfile(false)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm font-bold transition"
                    >
                      ✖️ Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Заголовок + кнопка создания */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-black gradient-text">⚔️ Персонажи ({filteredCharacters.length})</h2>
          <Link
            to="/character/create"
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-white hover:from-purple-700 hover:to-pink-700 transition shadow-lg"
          >
            ➕ Создать
          </Link>
        </div>

        {/* Фильтры (Лаба 3) */}
        <div className="mb-6 bg-gray-900/60 border border-purple-500/30 rounded-2xl p-4 flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="🔍 Поиск по имени..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none flex-1 min-w-[160px]"
          />
          <select
            value={raceFilter}
            onChange={(e) => setRaceFilter(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none"
          >
            <option value="">🌍 Все расы</option>
            <option value="human">Человек</option>
            <option value="elf">Эльф</option>
            <option value="orc">Орк</option>
            <option value="dwarf">Дворф</option>
            <option value="skeleton">Скелет</option>
            <option value="vampire">Вампир</option>
            <option value="demon">Демон</option>
            <option value="wraith">Призрак</option>
            <option value="dragonborn">Драконорождённый</option>
          </select>
          <select
            value={weaponFilter}
            onChange={(e) => setWeaponFilter(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none"
          >
            <option value="">🗡️ Всё оружие</option>
            <option value="sword">Меч</option>
            <option value="staff">Посох</option>
            <option value="dagger">Кинжал</option>
            <option value="axe">Топор</option>
            <option value="bow">Лук</option>
            <option value="scythe">Коса</option>
            <option value="flail">Цеп</option>
            <option value="crossbow">Арбалет</option>
            <option value="claws">Когти</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none"
            title="Сортировка"
          >
            <option value="id">🆔 По ID</option>
            <option value="name">🔤 По имени</option>
            <option value="hp">❤️ По HP</option>
            <option value="strength">💪 По силе</option>
            <option value="dexterity">🏃 По ловкости</option>
            <option value="level">⭐ По уровню</option>
            <option value="created_at">📅 По дате</option>
          </select>
          <button
            onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-white font-bold transition"
            title={sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
          >
            {sortOrder === 'asc' ? '⬆️' : '⬇️'}
          </button>
          <button
            onClick={() => { setSearchTerm(''); setRaceFilter(''); setWeaponFilter(''); setSortBy('id'); setSortOrder('desc'); }}
            className="px-4 py-2 bg-purple-600/50 hover:bg-purple-600 rounded-lg text-white font-bold transition"
          >
            Сбросить
          </button>
        </div>

        {loading && (
          <div className="text-center text-xl text-gray-400">⏳ Загрузка...</div>
        )}

        {!loading && filteredCharacters.length === 0 && (
          <div className="text-center text-xl text-gray-400">🤷 Нет персонажей</div>
        )}

        {/* Карточки персонажей */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCharacters.map((char) => {
            const cls = classAccent[char.character_class || 'warrior'] || classAccent.warrior;
            return (
            <div key={char.id} className={`card bg-gray-800/80 p-6 rounded-2xl border ${raceBorderColors[char.race] || 'border-purple-500/50'} ${cls.ring} flex flex-col gap-3 hover:shadow-lg hover:shadow-purple-500/10 transition-shadow`}>

              {/* Аватар + загрузка (Лаба 3) */}
              <div className="flex items-center gap-4">
                <CharacterAvatarUpload
                  characterId={char.id}
                  currentAvatarUrl={char.avatar_url}
                  token={token}
                  onAvatarChange={(url) => handleAvatarChange(char.id, url)}
                  race={char.race}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-black text-cyan-400 break-words leading-tight">{raceIcons[char.race] || '⚔️'} {char.name}</h3>
                  <p className="text-sm text-gray-400">
                    {raceNames[char.race] || char.race} · {weaponIcons[char.weapon] || '🗡️'} {weaponNames[char.weapon] || char.weapon}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                    <span className={`px-2 py-0.5 border rounded-md font-bold ${cls.badge}`}>
                      {cls.label}
                    </span>
                    <span className="px-2 py-0.5 bg-yellow-900/40 border border-yellow-500/40 rounded-md text-yellow-300 font-bold">
                      ⭐ Ур. {char.level ?? 1}
                    </span>
                    {char.created_at && (
                      <span className="text-gray-500" title={new Date(char.created_at).toLocaleString('ru-RU')}>
                        📅 {new Date(char.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Характеристики */}
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-2">
                  <div className="text-red-400 font-bold">❤️ {char.hp}</div>
                  <div className="text-gray-500 text-xs">HP</div>
                </div>
                <div className="bg-orange-900/30 border border-orange-500/30 rounded-lg p-2">
                  <div className="text-orange-400 font-bold">💪 {char.strength}</div>
                  <div className="text-gray-500 text-xs">Сила</div>
                </div>
                <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-2">
                  <div className="text-blue-400 font-bold">🏃 {char.dexterity}</div>
                  <div className="text-gray-500 text-xs">Ловкость</div>
                </div>
              </div>

              {/* XP прогресс */}
              {(char.xp ?? 0) > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>XP</span>
                    <span>{char.xp}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all"
                      style={{ width: `${Math.min(100, ((char.xp ?? 0) / (50 + ((char.level ?? 1) - 1) * 75)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Действия */}
              {char.is_alive ? (
                <div className="flex gap-2 mt-auto">
                  <Link
                    to={`/story/${char.id}`}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-bold text-white text-center hover:from-purple-700 hover:to-pink-700 transition text-sm"
                  >
                    {char.has_story ? '📜 Продолжить путь' : '🎮 Играть'}
                  </Link>
                  <button
                    onClick={() => handleDelete(char.id)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-white transition text-sm"
                    title="Удалить персонажа"
                  >
                    🗑️
                  </button>
                </div>
              ) : (
                <div className="mt-auto p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 font-bold text-center text-sm">
                  💀 Мёртв
                </div>
              )}

              {/* Кнопки инвентаря и достижений */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => toggleInventory(char.id)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-bold transition ${
                    inventoryOpen === char.id
                      ? 'bg-amber-700/30 border-amber-500/60 text-amber-200'
                      : 'bg-black/20 border-white/10 text-gray-400 hover:border-amber-500/40 hover:text-amber-300'
                  }`}
                >
                  {itemsLoading === char.id ? '⏳' : inventoryOpen === char.id ? '🔒 Рюкзак' : '📦 Инвентарь'}
                </button>
                <button
                  onClick={() => toggleAchievements(char.id)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-bold transition ${
                    achOpen === char.id
                      ? 'bg-yellow-700/30 border-yellow-500/60 text-yellow-200'
                      : 'bg-black/20 border-white/10 text-gray-400 hover:border-yellow-500/40 hover:text-yellow-300'
                  }`}
                  title="Достижения"
                >
                  {achLoading === char.id ? '⏳' : achOpen === char.id ? '🔒 Свернуть' : '🏅 Ачивки'}
                </button>
              </div>

              {/* Список предметов */}
              {inventoryOpen === char.id && (
                <div className="mt-2 space-y-1">
                  {!charItems[char.id] || charItems[char.id].length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-2 bg-black/30 rounded-lg">📭 Рюкзак пуст</div>
                  ) : (
                    charItems[char.id].map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-amber-900/20 border border-amber-500/20 text-gray-200"
                      >
                        <span className="text-lg shrink-0">{EFFECT_ICONS[item.effect_type] ?? '📦'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate">{item.name}</div>
                          {item.description && <div className="text-gray-500 truncate text-xs">{item.description}</div>}
                        </div>
                        {item.effect_value > 0 && (
                          <span className="shrink-0 text-amber-400 font-bold text-xs">{formatEffect(item.effect_type, item.effect_value)}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Список достижений */}
              {achOpen === char.id && (
                <div className="mt-2 p-3 bg-gradient-to-br from-yellow-900/20 to-purple-950/30 rounded-xl border border-yellow-500/30">
                  {!charAch[char.id] || charAch[char.id].length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-2">Загрузка...</div>
                  ) : (
                    <>
                      <div className="text-sm text-yellow-200 font-bold mb-2">
                        🏅 {charAch[char.id].filter(a => a.unlocked).length} / {charAch[char.id].length}
                      </div>
                      <div className="space-y-1">
                        {charAch[char.id].map((a) => (
                          <div
                            key={a.code}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm border ${
                              a.unlocked
                                ? 'bg-yellow-600/20 border-yellow-400/60 text-yellow-100'
                                : 'bg-gray-900/40 border-gray-700/50 text-gray-500 grayscale opacity-70'
                            }`}
                            title={a.description}
                          >
                            <span className="text-lg shrink-0">{a.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold truncate">{a.title}</div>
                              <div className="text-xs truncate opacity-80">{a.description}</div>
                            </div>
                            {a.unlocked ? (
                              <span className="shrink-0 text-green-300 text-xs font-bold">✓</span>
                            ) : (
                              <span className="shrink-0 text-gray-600 text-xs">🔒</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default Profile;
