import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const KEY = 'guide-du-chretien:favorites';

interface FavoritesValue {
  favorites: string[];
  isFavorite: (slug: string) => boolean;
  toggle: (slug: string) => void;
}

const FavoritesContext = createContext<FavoritesValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => v && setFavorites(JSON.parse(v)))
      .catch(() => undefined);
  }, []);

  const toggle = useCallback((slug: string) => {
    setFavorites((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [slug, ...prev];
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ favorites, toggle, isFavorite: (slug: string) => favorites.includes(slug) }),
    [favorites, toggle],
  );
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites doit être utilisé dans <FavoritesProvider>');
  return ctx;
}
