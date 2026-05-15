import React, { useRef, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface Props {
  characterId: number;
  currentAvatarUrl: string | null | undefined;
  token: string | null;
  onAvatarChange: (newUrl: string | null) => void;
  race?: string;
}

const RACE_EMOJIS: Record<string, string[]> = {
  human: ['🧑', '🧙', '🤡'],
  elf: ['🧝', '🧚', '🤰'],
  orc: ['👹', '👺', '🦾'],
  dwarf: ['⛏️', '🧔', '🪓'],
  skeleton: ['💀', '☠️', '🦴'],
  vampire: ['🧛', '🦇', '🩸'],
  demon: ['😈', '👿', '🔥'],
  wraith: ['👻', '👴', '🌚'],
  dragonborn: ['🐉', '🐲', '🦎'],
};

function pickRaceEmoji(race: string | undefined, id: number): string {
  const arr = RACE_EMOJIS[race ?? ''];
  if (!arr) return '🧙';
  return arr[Math.abs(id) % arr.length];
}

const CharacterAvatarUpload: React.FC<Props> = ({
  characterId,
  currentAvatarUrl,
  token,
  onAvatarChange,
  race,
}) => {
  const fallbackEmoji = pickRaceEmoji(race, characterId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl ?? null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Клиентская валидация типа файла
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Недопустимый формат, вирус подкинуть хочешь?. Разрешены токо: JPEG, PNG, GIF, WebP');
      return;
    }

    // Клиентская валидация размера
    if (file.size > MAX_SIZE_BYTES) {
      setError(`Файл слишком жирный ало. Максимум ${MAX_SIZE_MB} MB`);
      return;
    }

    // Показываем превью сразу
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post(
        `${API_BASE}/characters/${characterId}/avatar`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            // Content-Type выставляет axios автоматически для FormData
          },
        }
      );

      onAvatarChange(res.data.avatar_url);
      setPreviewUrl(res.data.avatar_url);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err)
          ? err.response?.data?.detail ?? 'Ошибка загрузки'
          : 'Ошибка загрузки';
      setError(msg);
      // Откатываем превью
      setPreviewUrl(currentAvatarUrl ?? null);
    } finally {
      setUploading(false);
      // Сбрасываем input чтобы можно было загрузить тот же файл повторно
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!previewUrl) return;
    if (!confirm('Удалить этот ужасный аватар персонажа?')) return;

    setError(null);
    setDeleting(true);
    try {
      await axios.delete(`${API_BASE}/characters/${characterId}/avatar`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPreviewUrl(null);
      onAvatarChange(null);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err)
          ? err.response?.data?.detail ?? 'Ошибка удаления'
          : 'Ошибка удаления';
      setError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Аватар / заглушка */}
      <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-purple-500/60 bg-gray-700 flex items-center justify-center">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Аватар"
            className="w-full h-full object-cover"
            onError={() => setPreviewUrl(null)}
          />
        ) : (
          <span className="text-3xl select-none">{fallbackEmoji}</span>
        )}

        {/* Оверлей загрузки */}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Ошибка */}
      {error && (
        <p className="text-red-400 text-xs text-center max-w-[160px]">{error}</p>
      )}

      {/* Кнопки */}
      <div className="flex gap-1">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-1 text-xs bg-purple-600/40 hover:bg-purple-600/70 text-purple-200 border border-purple-500/50 rounded-lg transition disabled:opacity-50"
          title="Загрузить аватар"
        >
          {uploading ? '⏳' : '📷 Загрузить'}
        </button>

        {previewUrl && (
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="px-2 py-1 text-xs bg-red-600/30 hover:bg-red-600/60 text-red-300 border border-red-500/40 rounded-lg transition disabled:opacity-50"
            title="Удалить аватар"
          >
            {deleting ? '⏳' : '🗑️'}
          </button>
        )}
      </div>

      {/* Скрытый input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="hidden"
        onChange={handleFileChange}
      />

      <p className="text-gray-500 text-xs">JPEG/PNG/GIF/WebP · макс {MAX_SIZE_MB} MB</p>
    </div>
  );
};

export default CharacterAvatarUpload;
