import React, { useCallback, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE;

type InspirationData = {
  kind: 'spell' | 'monster';
  id: string;
  name: string;
  description?: string;
  level?: number;
  school?: string;
  type?: string;
  challenge_rating?: number;
  hit_points?: number;
};

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: InspirationData };

const Inspiration: React.FC = () => {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setImageUrl(null);
    setImageLoading(false);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(`${API_BASE}/api/external/inspiration`, { signal: controller.signal });
      clearTimeout(timeout);

      if (resp.status === 503) {
        setState({ status: 'error', message: 'Внешний API D&D временно недоступен. Попробуйте позже.' });
        return;
      }
      if (!resp.ok) {
        setState({ status: 'error', message: `Ошибка ${resp.status}` });
        return;
      }
      const data: InspirationData = await resp.json();
      if (!data || !data.name) {
        setState({ status: 'empty' });
        return;
      }

      setState({ status: 'success', data });

      // Генерация картинки в фоне — не блокирует отображение D&D контента
      setImageLoading(true);
      const prompt = `${data.name} ${data.description ?? ''}`.slice(0, 250);
      fetch(`${API_BASE}/api/external/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(json => { if (json?.image) setImageUrl(json.image); })
        .catch(() => {})
        .finally(() => setImageLoading(false));

    } catch (e) {
      setState({ status: 'error', message: 'Не удалось загрузить вдохновение.' });
    }
  }, []);

  return (
    <section
      aria-label="Случайное вдохновение из D&D"
      className="mt-10 p-6 rounded-2xl bg-black/40 border border-purple-500/30 backdrop-blur-sm max-w-xl mx-auto text-left"
    >
      <h2 className="text-2xl font-bold text-purple-300 mb-3">🎲 Вдохновение из D&amp;D</h2>
      <p className="text-gray-300 text-sm mb-4">
        Получи случайное заклинание или монстра из открытого D&amp;D 5e API — используй в своих историях.
      </p>

      <button
        onClick={load}
        disabled={state.status === 'loading'}
        className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold transition"
      >
        {state.status === 'loading' ? 'Загрузка…' : 'Вдохновить меня'}
      </button>

      <div className="mt-4 min-h-[60px]" role="status" aria-live="polite">
        {state.status === 'loading' && (
          <p className="text-gray-400">Запрос к внешнему API…</p>
        )}
        {state.status === 'empty' && (
          <p className="text-gray-400">Результатов не найдено.</p>
        )}
        {state.status === 'error' && (
          <p className="text-red-400">{state.message}</p>
        )}
        {state.status === 'success' && (
          <article className="text-white">
            <div className="flex gap-4 items-start">

              {/* Картинка — FLUX.1-schnell через бэк */}
              <div className="w-[200px] h-[200px] flex-shrink-0 rounded-xl overflow-hidden border border-purple-500/40 bg-purple-950/40">
                {imageLoading && !imageUrl && (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-400 border-t-transparent" />
                    <span className="text-xs text-purple-400">AI рисует…</span>
                  </div>
                )}
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={state.data.name}
                    className="w-full h-full object-cover"
                  />
                )}
                {!imageLoading && !imageUrl && (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-purple-600 text-3xl">🖼️</span>
                  </div>
                )}
              </div>

              {/* D&D контент */}
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-pink-300">
                  {state.data.name}
                  <span className="ml-2 text-xs uppercase tracking-wider text-purple-400">
                    {state.data.kind === 'spell' ? 'заклинание' : 'монстр'}
                  </span>
                </h3>
                <dl className="text-sm text-gray-300 mt-2 space-y-1">
                  {state.data.kind === 'spell' && (
                    <>
                      <div><dt className="inline font-bold">Уровень: </dt><dd className="inline">{state.data.level}</dd></div>
                      <div><dt className="inline font-bold">Школа: </dt><dd className="inline">{state.data.school}</dd></div>
                    </>
                  )}
                  {state.data.kind === 'monster' && (
                    <>
                      <div><dt className="inline font-bold">Тип: </dt><dd className="inline">{state.data.type}</dd></div>
                      <div><dt className="inline font-bold">CR: </dt><dd className="inline">{state.data.challenge_rating}</dd></div>
                      <div><dt className="inline font-bold">HP: </dt><dd className="inline">{state.data.hit_points}</dd></div>
                    </>
                  )}
                </dl>
                {state.data.description && (
                  <p className="mt-3 text-gray-200 text-sm leading-relaxed">{state.data.description}</p>
                )}
              </div>
            </div>
          </article>
        )}
      </div>
    </section>
  );
};

export default Inspiration;
