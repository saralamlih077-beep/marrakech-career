import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useOfferFavorites() {
  const [favoriteOffers, setFavoriteOffers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchFavoriteOffers = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFavoriteOffers(new Set());
        return;
      }
      const raw = user.user_metadata?.favorite_offer_ids;
      const ids = Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
      setFavoriteOffers(new Set(ids));
    } catch (error) {
      console.error('Error fetching favorite offers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFavoriteOffers();
  }, [fetchFavoriteOffers]);

  const toggleOfferFavorite = async (id: string) => {
    const previous = favoriteOffers;
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFavoriteOffers(next);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFavoriteOffers(previous);
        return;
      }
      const { error } = await supabase.auth.updateUser({
        data: { favorite_offer_ids: Array.from(next) },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Failed to toggle favorite offer:', error);
      setFavoriteOffers(previous);
    }
  };

  return { favoriteOffers, loading, toggleOfferFavorite, refetch: fetchFavoriteOffers };
}
