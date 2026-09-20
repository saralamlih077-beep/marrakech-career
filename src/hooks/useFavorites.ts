import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFavorites(new Set());
        setLoading(false);
        return;
      }

      // 1. Fetch from real 'favoris' table
      const { data: rows, error } = await supabase
        .from('favoris')
        .select('entreprise_id');

      if (!error && rows && rows.length > 0) {
        const ids = rows
          .map((r: { entreprise_id: number | string }) => Number(r.entreprise_id))
          .filter((id) => !isNaN(id));
        setFavorites(new Set(ids));
      } else {
        // Fallback to user_metadata if favoris table is empty or just migrated
        const raw = user.user_metadata?.favorite_company_ids;
        const ids = Array.isArray(raw) ? raw.filter((id): id is number => typeof id === 'number') : [];
        setFavorites(new Set(ids));
      }
    } catch (err) {
      console.error('Error fetching favorites:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFavorites();
  }, [fetchFavorites]);

  const toggleFavorite = async (id: number) => {
    const isCurrentlyFav = favorites.has(id);
    const next = new Set(favorites);
    if (isCurrentlyFav) {
      next.delete(id);
    } else {
      next.add(id);
    }
    // Optimistic update
    setFavorites(next);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFavorites(favorites); // rollback
        return;
      }

      if (isCurrentlyFav) {
        const { error } = await supabase
          .from('favoris')
          .delete()
          .eq('entreprise_id', id);

        if (error) {
          console.error('Error removing favorite:', error);
          setFavorites(favorites);
          return;
        }
      } else {
        const { error } = await supabase
          .from('favoris')
          .insert({
            user_id: user.id,
            entreprise_id: id,
          });

        if (error) {
          console.error('Error adding favorite:', error);
          setFavorites(favorites);
          return;
        }
      }

      // Sync metadata in background as backup
      void supabase.auth.updateUser({
        data: { favorite_company_ids: Array.from(next) },
      });
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      setFavorites(favorites);
    }
  };

  return { favorites, loading, toggleFavorite, refetch: fetchFavorites };
}
