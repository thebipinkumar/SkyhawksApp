import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api from '../utils/api';

interface ClubSettings {
  club_name: string;
  tagline: string;
  founded: string;
  description: string;
  contact_email: string;
  ground: string;
  logo_url: string | null;
  achievements: string[];
  stats: { members: number; matches: number; wins: number };
}

interface ClubContextType {
  club: ClubSettings | null;
  refresh: () => void;
}

const ClubContext = createContext<ClubContextType>({ club: null, refresh: () => {} });

export function ClubProvider({ children }: { children: ReactNode }) {
  const [club, setClub] = useState<ClubSettings | null>(null);

  const refresh = useCallback(() => {
    api.get('/public/about').then(r => setClub(r.data)).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <ClubContext.Provider value={{ club, refresh }}>{children}</ClubContext.Provider>;
}

export function useClub() { return useContext(ClubContext); }
