import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import { AuthContext } from '../App';
import { AuthContextType } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE;

// Базовые статы расы: [hp, strength, dexterity]
const RACE_BASES: Record<string, [number, number, number]> = {
  human:      [10, 5, 5],
  elf:        [8,  4, 8],
  orc:        [13, 8, 3],
  dwarf:      [11, 7, 4],
  skeleton:   [6,  7, 5],
  vampire:    [9,  6, 7],
  demon:      [12, 8, 3],
  wraith:     [7,  3, 9],
  dragonborn: [14, 9, 2],
};

// Модификаторы оружия: [dHP, dStr, dDex]
const WEAPON_MODS: Record<string, [number, number, number]> = {
  sword:    [0,  1,  0],
  staff:    [0, -1,  1],
  dagger:   [0,  0,  2],
  axe:      [0,  2, -1],
  bow:      [0, -1,  2],
  scythe:   [0,  2, -1],
  flail:    [1,  1, -1],
  crossbow: [0,  0,  1],
  claws:    [0,  1,  2],
};

// Модификаторы класса: [dHP, dStr, dDex]
const CLASS_MODS: Record<string, [number, number, number]> = {
  warrior:     [0,  0,  0],
  berserker:   [2,  3, -2],
  rogue:       [0, -1,  3],
  necromancer: [-1, -1, 1],
};

const COMPANION_INFO: Record<string, { icon: string; name: string; desc: string; color: string }> = {
  none:     { icon: '🚫', name: 'Без компаньона', desc: 'Идёшь один. Никакой помощи, но и некого терять.',          color: 'from-gray-700 to-gray-900' },
  wolf:     { icon: '🐺', name: 'Сумрачный Волк', desc: 'Атакует вместе с тобой, грызёт врага и восстанавливает HP. Может принять удар на себя.',    color: 'from-gray-600 to-blue-700' },
  skeleton: { icon: '💀', name: 'Костяной Страж', desc: 'Крушит врага костяным кулаком и возвращает тебе HP. Закрывает от сильных ударов.',  color: 'from-gray-800 to-purple-800' },
  spirit:   { icon: '👻', name: 'Павший Дух',     desc: 'Леденит врага и подпитывает тебя жизнью. Может принять удар вместо тебя.', color: 'from-cyan-700 to-indigo-800' },
};

const CLASS_INFO: Record<string, { icon: string; name: string; desc: string; color: string }> = {
  warrior:     { icon: '🛡️', name: 'Воин',     desc: 'Сбалансированный боец без штрафов.',                        color: 'from-blue-600 to-cyan-600' },
  berserker:   { icon: '🔥', name: 'Берсерк',   desc: 'Авто-ярость при HP ≤ 30. +3 СИЛА, −2 ЛОВ, +2 HP базы.',    color: 'from-orange-600 to-red-700' },
  rogue:       { icon: '🗡️', name: 'Разбойник', desc: '+5 к уворотам. +3 ЛОВ, −1 СИЛА.',                          color: 'from-purple-600 to-pink-600' },
  necromancer: { icon: '💀', name: 'Некромант', desc: 'На крит. ударе 40% шанс высосать 3–6 HP. −1 HP/СИЛА.',     color: 'from-indigo-700 to-gray-800' },
};

function calcStats(race: string, weapon: string, cls: string = 'warrior'): { hp: number; strength: number; dexterity: number } {
  const [bHp, bStr, bDex] = RACE_BASES[race] ?? [10, 5, 5];
  const [dHp, dStr, dDex] = WEAPON_MODS[weapon] ?? [0, 0, 0];
  const [cHp, cStr, cDex] = CLASS_MODS[cls] ?? [0, 0, 0];
  return {
    hp:        Math.max(1, bHp + dHp + cHp),
    strength:  Math.max(1, bStr + dStr + cStr),
    dexterity: Math.max(1, bDex + dDex + cDex),
  };
}

const FREE_POINTS = 5;

// Макс. на сколько можно уменьшить стат относительно базы (каждая единица даёт +1 в свободный пул)
const REDUCE_LIMIT: Record<'hp' | 'strength' | 'dexterity', number> = {
  hp: 3,
  strength: 2,
  dexterity: 2,
};

function statMin(stat: 'hp' | 'strength' | 'dexterity', baseVal: number): number {
  return Math.max(1, baseVal - REDUCE_LIMIT[stat]);
}

function formatMod(mod: [number, number, number]): string {
  const [dHp, dStr, dDex] = mod;
  const parts: string[] = [];
  if (dHp)  parts.push(`HP ${dHp > 0 ? '+' : ''}${dHp}`);
  if (dStr) parts.push(`Сила ${dStr > 0 ? '+' : ''}${dStr}`);
  if (dDex) parts.push(`Ловкость ${dDex > 0 ? '+' : ''}${dDex}`);
  return parts.join(', ') || 'без модификаторов';
}

const CharacterCreator: React.FC = () => {
  const { token } = useContext(AuthContext) as AuthContextType;
  const navigate = useNavigate();
  const initStats = calcStats('human', 'sword', 'warrior');
  const [form, setForm] = useState({
    name: '',
    race: 'human',
    weapon: 'sword',
    character_class: 'warrior' as 'warrior' | 'berserker' | 'rogue' | 'necromancer',
    ...initStats,
  });
  const [base, setBase] = useState(initStats);
  const [pointsLeft, setPointsLeft] = useState(FREE_POINTS);
  const [statInputs, setStatInputs] = useState({
    hp: String(initStats.hp),
    strength: String(initStats.strength),
    dexterity: String(initStats.dexterity),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [companionKind, setCompanionKind] = useState<'none' | 'wolf' | 'skeleton' | 'spirit'>('none');

  const handleChange = (field: string, value: string | number) => {
    setForm(prev => {
      let newForm = { ...prev, [field]: value };
      let newBase = base;

      // При смене расы/оружия/класса — сбрасываем статы на новую базу, свободные очки восстанавливаются
      if (field === 'race' || field === 'weapon' || field === 'character_class') {
        const race   = field === 'race'            ? String(value) : prev.race;
        const weapon = field === 'weapon'          ? String(value) : prev.weapon;
        const cls    = field === 'character_class' ? String(value) : prev.character_class;
        newBase = calcStats(race, weapon, cls);
        newForm = { ...newForm, ...newBase };
        setBase(newBase);
        setStatInputs({
          hp: String(newBase.hp),
          strength: String(newBase.strength),
          dexterity: String(newBase.dexterity),
        });
      }

      const spent =
        (newForm.hp - newBase.hp) +
        (newForm.strength - newBase.strength) +
        (newForm.dexterity - newBase.dexterity);
      setPointsLeft(FREE_POINTS - spent);
      setFieldErrors(fe => ({ ...fe, [field]: '' }));
      return newForm;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      newErrors.name = 'Имя персонажа обязательно';
    } else if (form.name.length < 2) {
      newErrors.name = 'Имя должно быть минимум 2 символа';
    } else if (form.name.length > 50) {
      newErrors.name = 'Имя не может быть больше 50 символов';
    }

    if (pointsLeft < 0) {
      newErrors.stats = `Превышен лимит очков на ${Math.abs(pointsLeft)}`;
    }

    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/characters/`, form, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      if (companionKind !== 'none' && res.data?.id) {
        try {
          await axios.post(
            `${API_BASE}/characters/${res.data.id}/companion`,
            { kind: companionKind },
            { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 },
          );
        } catch {
          // не критично — идём дальше без компаньона
        }
      }

      navigate('/profile', { replace: true, state: { refresh: Date.now() } });
    } catch (err: unknown) {
      const error = err as AxiosError;
      const serverError = (error.response?.data as any)?.detail;
      
      if (typeof serverError === 'string') {
        if (serverError.includes('Сумма очков') || serverError.includes('stats')) {
          setFieldErrors(prev => ({ ...prev, stats: serverError }));
        } else if (serverError.includes('имя') || serverError.includes('name')) {
          setFieldErrors(prev => ({ ...prev, name: serverError }));
        } else {
          setError(`❌ Ошибка сервера: ${serverError}`);
        }
      } else if (Array.isArray(serverError)) {
        const newErrors: Record<string, string> = {};
        serverError.forEach((err: any) => {
          const field = err.loc?.[1] || 'form';
          newErrors[field] = err.msg;
        });
        setFieldErrors(newErrors);
      } else {
        setError(`❌ Ошибка создания: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const inputBaseClass = "mt-1 block w-full px-4 py-3 bg-gray-800/70 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition";
  const selectBaseClass = `${inputBaseClass} py-[13px]`;
  const errorClass = "border-red-500/50 focus:ring-red-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => navigate('/profile')} />

      <div className="relative w-full max-w-lg bg-black/85 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/10 overflow-y-auto max-h-[90vh]">
        <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-purple-400 via-red-400 to-orange-400 text-transparent bg-clip-text">
          Призвать героя из тьмы
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300">
              Имя персонажа
            </label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              className={`${inputBaseClass} ${fieldErrors.name ? errorClass : ''}`}
              placeholder="Имя твоего героя"
            />
            {fieldErrors.name && (
              <p className="mt-1 text-sm text-red-400">⚠️ {fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="race" className="block text-sm font-medium text-gray-300">Раса</label>
            <select
              id="race"
              value={form.race}
              onChange={(e) => handleChange('race', e.target.value)}
              className={`${selectBaseClass} ${fieldErrors.race ? errorClass : ''}`}
            >
              <option value="human">🧑 Человек</option>
              <option value="elf">🧝 Эльф</option>
              <option value="orc">👹 Орк</option>
              <option value="dwarf">⛏️ Дворф</option>
              <option value="skeleton">💀 Скелет</option>
              <option value="vampire">🧛 Вампир</option>
              <option value="demon">😈 Демон</option>
              <option value="wraith">👻 Призрак</option>
              <option value="dragonborn">🐉 Драконорождённый</option>
            </select>
            {fieldErrors.race && (
              <p className="mt-1 text-sm text-red-400">⚠️ {fieldErrors.race}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Класс персонажа</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CLASS_INFO) as Array<keyof typeof CLASS_INFO>).map((key) => {
                const active = form.character_class === key;
                const info = CLASS_INFO[key];
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => handleChange('character_class', key)}
                    className={`text-left p-3 rounded-xl border-2 transition ${
                      active
                        ? `bg-gradient-to-br ${info.color} border-white/40 shadow-lg scale-[1.02]`
                        : 'bg-gray-800/50 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <span className="text-xl">{info.icon}</span>
                      <span className={active ? 'text-white' : 'text-gray-200'}>{info.name}</span>
                    </div>
                    <div className={`text-xs mt-1 ${active ? 'text-white/90' : 'text-gray-400'}`}>
                      {info.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Компаньон</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(COMPANION_INFO) as Array<keyof typeof COMPANION_INFO>).map((key) => {
                const active = companionKind === key;
                const info = COMPANION_INFO[key];
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setCompanionKind(key as typeof companionKind)}
                    className={`text-left p-3 rounded-xl border-2 transition ${
                      active
                        ? `bg-gradient-to-br ${info.color} border-white/40 shadow-lg scale-[1.02]`
                        : 'bg-gray-800/50 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <span className="text-xl">{info.icon}</span>
                      <span className={active ? 'text-white' : 'text-gray-200'}>{info.name}</span>
                    </div>
                    <div className={`text-xs mt-1 ${active ? 'text-white/90' : 'text-gray-400'}`}>
                      {info.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="weapon" className="block text-sm font-medium text-gray-300">Оружие</label>
            <select
              id="weapon"
              value={form.weapon}
              onChange={(e) => handleChange('weapon', e.target.value)}
              className={`${selectBaseClass} ${fieldErrors.weapon ? errorClass : ''}`}
            >
              <option value="sword">🗡️ Меч (Сила +1)</option>
              <option value="staff">🪄 Посох (Сила −1, Ловкость +1)</option>
              <option value="dagger">🔪 Кинжал (Ловкость +2)</option>
              <option value="axe">🪓 Топор (Сила +2, Ловкость −1)</option>
              <option value="bow">🏹 Лук (Сила −1, Ловкость +2)</option>
              <option value="scythe">⚰️ Коса (Сила +2, Ловкость −1)</option>
              <option value="flail">⛓️ Цеп (HP +1, Сила +1, Ловкость −1)</option>
              <option value="crossbow">🎯 Арбалет (Ловкость +1)</option>
              <option value="claws">🐺 Когти (Сила +1, Ловкость +2)</option>
            </select>
            <p className="mt-2 text-xs italic text-purple-300/70 font-serif tracking-wide">
              ⚡ Эффект: {formatMod(WEAPON_MODS[form.weapon] ?? [0, 0, 0])}
            </p>
            {fieldErrors.weapon && (
              <p className="mt-1 text-sm text-red-400">⚠️ {fieldErrors.weapon}</p>
            )}
          </div>

          <div className={`p-4 rounded-xl text-center font-semibold text-white ${pointsLeft < 0 ? 'bg-red-600/30 border border-red-500/50' : 'bg-green-600/30 border border-green-500/50'}`}>
            Свободных очков: <span className={pointsLeft < 0 ? 'text-red-400' : 'text-green-300'}>{pointsLeft}</span>
          </div>

          {fieldErrors.stats && (
            <div className="p-4 text-center text-red-400 bg-red-900/50 rounded-xl border border-red-500/50">
              ⚠️ {fieldErrors.stats}
            </div>
          )}

          {(['hp', 'strength', 'dexterity'] as const).map((stat) => {
            const minVal = statMin(stat, base[stat]);
            const maxVal = form[stat] + pointsLeft;
            const bonus = form[stat] - base[stat];
            const setStatValue = (newVal: number) => {
              const clamped = Math.max(minVal, Math.min(newVal, form[stat] + pointsLeft));
              setStatInputs(si => ({ ...si, [stat]: String(clamped) }));
              handleChange(stat, clamped);
            };
            return (
            <div key={stat} className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
              <label className="w-24 text-sm font-medium capitalize text-gray-300">
                {stat === 'hp' ? 'HP' : stat === 'strength' ? 'Сила' : 'Ловкость'}:
                <span className="block text-[10px] text-gray-500 font-normal">
                  база {base[stat]}{bonus !== 0 ? (bonus > 0 ? ` +${bonus}` : ` ${bonus}`) : ''}
                </span>
              </label>
              <button
                type="button"
                onClick={() => setStatValue(form[stat] - 1)}
                disabled={form[stat] <= minVal}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-900/40 border border-purple-500/40 text-purple-200 hover:bg-purple-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                title={`минимум ${minVal}`}
              >−</button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={statInputs[stat]}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setStatInputs(si => ({ ...si, [stat]: raw }));
                }}
                onBlur={() => {
                  const parsed = parseInt(statInputs[stat]);
                  if (isNaN(parsed)) {
                    setStatValue(minVal);
                  } else {
                    setStatValue(parsed);
                  }
                }}
                placeholder={String(minVal)}
                className="flex-1 p-2 text-center bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setStatValue(form[stat] + 1)}
                disabled={form[stat] >= maxVal || pointsLeft <= 0}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-900/40 border border-purple-500/40 text-purple-200 hover:bg-purple-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                title={pointsLeft <= 0 ? 'нет свободных очков' : ''}
              >+</button>
            </div>
            );
          })}

          {error && (
            <div className="p-4 mt-4 text-center text-red-400 bg-red-900/50 rounded-xl border border-red-500/50 animate-pulse">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              disabled={loading}
              className="px-6 py-4 rounded-lg font-bold text-lg transition bg-gray-700/60 hover:bg-gray-600 text-gray-200 border border-gray-500/40 disabled:opacity-50"
            >
              ✖️ Отмена
            </button>
            <button
              type="submit"
              disabled={loading || pointsLeft < 0}
              className="flex-1 py-4 px-6 rounded-lg font-bold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-xl hover:shadow-purple-500/50 hover:scale-[1.02] disabled:hover:scale-100"
            >
              {loading ? '⏳ Призыв...' : '🔥 Призвать из тьмы'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CharacterCreator;
