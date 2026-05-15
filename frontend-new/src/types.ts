export interface User {
  id: number;
  email: string;
  name: string;
  age: number;
  role: 'user' | 'moderator' | 'admin';
  avatar_key?: string | null;
  avatar_url?: string | null;
}

export interface Character {
  id: number;
  owner_id: number;
  name: string;
  race: string;
  weapon: string;
  hp: number;
  strength: number;
  dexterity: number;
  is_alive: boolean;
  avatar_key: string | null;
  avatar_url: string | null;
  level?: number;
  xp?: number;
  created_at?: string | null;
  status_poison?: number;
  status_bleeding?: number;
  status_berserk?: number;
  character_class?: 'warrior' | 'berserker' | 'rogue' | 'necromancer';
  has_story?: boolean;
  companion?: Companion | null;
}

export interface Companion {
  id: number;
  character_id: number;
  kind: 'wolf' | 'skeleton' | 'spirit';
  name: string;
  hp: number;
  is_alive: boolean;
  created_at: string;
}

export interface InventoryItem {
  id: number;
  character_id: number;
  name: string;
  description?: string | null;
  effect_type: string;
  effect_value: number;
  is_used: boolean;
  created_at: string;
}

export interface AuthContextType {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser?: (u: User | null) => void;
}
