import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../App';
import { AuthContextType } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE;

type Kind = 'like' | 'skull' | 'fire';

interface Props {
  messageId: number;
  initialLikes: number;
  initialSkulls: number;
  initialFires: number;
  initialMyRating: Kind | null;
  compact?: boolean;
}

const KIND_META: Record<Kind, { icon: string; label: string; activeClass: string }> = {
  like:  { icon: '👍', label: 'Круто',    activeClass: 'bg-green-600/40 border-green-400 text-green-200' },
  skull: { icon: '💀', label: 'Мёртв',    activeClass: 'bg-gray-700/70 border-gray-400 text-white' },
  fire:  { icon: '🔥', label: 'Жесть',    activeClass: 'bg-orange-600/40 border-orange-400 text-orange-200' },
};

const RatingBar: React.FC<Props> = ({ messageId, initialLikes, initialSkulls, initialFires, initialMyRating, compact }) => {
  const { token } = useContext(AuthContext) as AuthContextType;
  const [likes, setLikes] = useState(initialLikes);
  const [skulls, setSkulls] = useState(initialSkulls);
  const [fires, setFires] = useState(initialFires);
  const [my, setMy] = useState<Kind | null>(initialMyRating);
  const [busy, setBusy] = useState(false);

  const toggle = async (kind: Kind) => {
    if (busy || !token) return;
    setBusy(true);
    try {
      const res = await axios.post(
        `${API_BASE}/stories/messages/${messageId}/rate`,
        { kind },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setLikes(res.data.likes);
      setSkulls(res.data.skulls);
      setFires(res.data.fires);
      setMy(res.data.my_rating ?? null);
    } catch {
      // silent
    } finally {
      setBusy(false);
    }
  };

  const counts: Record<Kind, number> = { like: likes, skull: skulls, fire: fires };
  const size = compact ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5';

  return (
    <div className="flex gap-2 flex-wrap">
      {(Object.keys(KIND_META) as Kind[]).map((k) => {
        const active = my === k;
        const meta = KIND_META[k];
        return (
          <button
            key={k}
            onClick={() => toggle(k)}
            disabled={busy}
            className={`${size} rounded-full border font-bold transition disabled:opacity-60 ${
              active ? meta.activeClass : 'bg-black/30 border-white/10 text-gray-300 hover:border-white/30'
            }`}
            title={meta.label}
          >
            <span className="mr-1">{meta.icon}</span>
            <span>{counts[k]}</span>
          </button>
        );
      })}
    </div>
  );
};

export default RatingBar;
