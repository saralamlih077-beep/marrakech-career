import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { AdminAnalytics } from '../types/admin';

export function useAdminAnalytics() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const load = async () => {
      try {
        const { data: result, error: invokeError } = await supabase.functions.invoke('admin-analytics');
        if (invokeError) throw new Error('Impossible de charger les données administrateur. Réessayez dans quelques instants.');
        if (result?.schemaVersion !== 2 || !Array.isArray(result?.users?.registeredUsers)) {
          throw new Error('Le service de statistiques doit être mis à jour pour fournir les utilisateurs et leurs candidatures.');
        }
        if (active) setData(result as AdminAnalytics);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les statistiques.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [revision]);

  return { data, loading, error, reload };
}
