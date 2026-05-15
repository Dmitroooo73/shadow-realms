import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { AuthContext } from './AuthContext';
import { AuthContextType, User } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE;
const ROLES = ['user', 'moderator', 'admin'] as const;

interface AdminStats {
  total_users: number;
  total_characters: number;
  alive_characters: number;
  dead_characters: number;
  stories_today: number;
  total_stories: number;
  by_role: Record<string, number>;
}

const AdminPanel: React.FC = () => {
  const { user: currentUser, token } = useContext(AuthContext) as AuthContextType;

  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/users/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(res.data);
    } catch {
      setStats(null);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/users/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.detail ?? 'Ошибка загрузки пользователей'
          : 'Ошибка загрузки'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadStats();
  }, []);

  const handleRoleChange = async (userId: number, newRole: string) => {
    setChangingRole(userId);
    setSuccessMsg(null);
    try {
      const res = await axios.patch(
        `${API_BASE}/users/${userId}/role`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: res.data.role } : u))
      );
      setSuccessMsg(`Роль пользователя #${userId} изменена на ${newRole}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.detail ?? 'Ошибка смены роли'
          : 'Ошибка'
      );
    } finally {
      setChangingRole(null);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm(`Удалить этого нища #${userId}? Это действие нельзя отменить.`)) return;
    setDeletingId(userId);
    try {
      await axios.delete(`${API_BASE}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSuccessMsg(`Пользователь #${userId} удалён`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.detail ?? 'Ошибка удаления'
          : 'Ошибка'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const roleColor: Record<string, string> = {
    admin: 'text-red-400',
    moderator: 'text-yellow-400',
    user: 'text-green-400',
  };

  return (
    <div className="container mx-auto px-4 py-12 relative z-10">
      <div className="bg-gray-800/80 backdrop-blur-xl border border-yellow-500/30 rounded-2xl p-8 shadow-[0_0_40px_rgba(234,179,8,0.15)] max-w-5xl mx-auto">

        {/* Заголовок */}
        <div className="flex items-center gap-4 mb-8 border-b border-gray-700 pb-6">
          <span className="text-5xl">⚙️</span>
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-yellow-400 to-orange-500 text-transparent bg-clip-text">
              Легендарная Панель Администратора
            </h1>
            <p className="text-gray-400 mt-1">
              Вы вошли как:{' '}
              <span className="text-red-400 font-bold uppercase">{currentUser?.role}</span>
            </p>
          </div>
        </div>

        {/* KPI Dashboard */}
        {stats && (
          <div className="mb-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-500/40 rounded-xl p-4">
              <div className="text-xs text-purple-300 uppercase tracking-wider">Пользователи</div>
              <div className="text-3xl font-black text-white mt-1">{stats.total_users}</div>
            </div>
            <div className="bg-gradient-to-br from-cyan-900/50 to-cyan-800/30 border border-cyan-500/40 rounded-xl p-4">
              <div className="text-xs text-cyan-300 uppercase tracking-wider">Персонажей</div>
              <div className="text-3xl font-black text-white mt-1">{stats.total_characters}</div>
            </div>
            <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 border border-green-500/40 rounded-xl p-4">
              <div className="text-xs text-green-300 uppercase tracking-wider">Живых</div>
              <div className="text-3xl font-black text-white mt-1">{stats.alive_characters}</div>
            </div>
            <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 border border-red-500/40 rounded-xl p-4">
              <div className="text-xs text-red-300 uppercase tracking-wider">💀 Мёртвых</div>
              <div className="text-3xl font-black text-white mt-1">{stats.dead_characters}</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 border border-yellow-500/40 rounded-xl p-4">
              <div className="text-xs text-yellow-300 uppercase tracking-wider">Историй сегодня</div>
              <div className="text-3xl font-black text-white mt-1">{stats.stories_today}</div>
            </div>
            <div className="bg-gradient-to-br from-pink-900/50 to-pink-800/30 border border-pink-500/40 rounded-xl p-4">
              <div className="text-xs text-pink-300 uppercase tracking-wider">Всего историй</div>
              <div className="text-3xl font-black text-white mt-1">{stats.total_stories}</div>
            </div>
            <div className="col-span-2 md:col-span-3 lg:col-span-6 bg-gray-900/60 border border-gray-700 rounded-xl p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Распределение по ролям</div>
              <div className="flex flex-wrap gap-3">
                {Object.entries(stats.by_role).map(([r, n]) => (
                  <span
                    key={r}
                    className={`px-3 py-1 rounded-full text-sm font-bold border ${
                      r === 'admin' ? 'text-red-300 border-red-500/40 bg-red-900/30'
                      : r === 'moderator' ? 'text-yellow-300 border-yellow-500/40 bg-yellow-900/30'
                      : 'text-green-300 border-green-500/40 bg-green-900/30'
                    }`}
                  >
                    {r}: {n}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Уведомления */}
        {successMsg && (
          <div className="mb-4 px-4 py-3 bg-green-900/40 border border-green-500/50 text-green-300 rounded-lg text-sm">
            ✅ {successMsg}
          </div>
        )}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-900/40 border border-red-500/50 text-red-300 rounded-lg text-sm flex justify-between items-center">
            <span>❌ {error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 ml-4">✕</button>
          </div>
        )}

        {/* Управление пользователями */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              👥 Твои холопы
              <span className="text-sm text-gray-400 font-normal">({users.length})</span>
            </h2>
            <button
              onClick={() => { loadUsers(); loadStats(); }}
              disabled={loading}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition"
            >
              🔄 Обновить
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">⏳ Загрузка...</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-700/50">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">#</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">Имя</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">Email</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">Возраст</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">Роль</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">Сменить роль</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/40">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-700/20 transition">
                      <td className="px-4 py-3 text-gray-500">{u.id}</td>
                      <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-gray-300">{u.email}</td>
                      <td className="px-4 py-3 text-gray-400">{u.age}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold uppercase text-xs ${roleColor[u.role] ?? 'text-gray-400'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.id !== currentUser?.id ? (
                          <select
                            value={u.role}
                            disabled={changingRole === u.id}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="bg-gray-700 border border-gray-600 text-white text-xs rounded-lg px-2 py-1 focus:border-yellow-500 outline-none disabled:opacity-50"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-600 text-xs">— вы сами</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.id !== currentUser?.id ? (
                          <button
                            onClick={() => handleDelete(u.id)}
                            disabled={deletingId === u.id}
                            className="px-3 py-1 text-xs bg-red-600/30 hover:bg-red-600/60 text-red-300 border border-red-500/30 rounded-lg transition disabled:opacity-50"
                          >
                            {deletingId === u.id ? '⏳' : '🗑️ Удалить'}
                          </button>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className="text-center py-8 text-gray-500">Нет пользователей</div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminPanel;
