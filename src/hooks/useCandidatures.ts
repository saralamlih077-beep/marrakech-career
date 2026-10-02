import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export type CandidatureStatus = 'saved' | 'prepared' | 'applied' | 'interview' | 'accepted' | 'rejected';

export interface Candidature {
  id: string;
  user_id?: string;
  entreprise_id: number | null;
  statut: string;
  poste: string;
  notes?: string;
  contact_email?: string;
  date_postulee?: string | null;
  follow_up_at?: string | null;
  company_reply?: string;
  replied_at?: string | null;
  cover_letter?: string;
  candidate_name?: string;
  candidate_email?: string;
  cv_bucket?: string;
  cv_path?: string;
  cv_file_name?: string;
  cv_content_type?: string;
  delivery_status?: 'draft' | 'queued' | 'sent' | 'failed' | string;
  delivery_error?: string;
  sent_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CreateCandidaturePayload {
  entreprise_id: number | null;
  poste: string;
  statut?: CandidatureStatus | string;
  notes?: string;
  contact_email?: string;
}

function parseCandidatures(rows: unknown): Candidature[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row): Candidature[] => {
    if (typeof row !== 'object' || row === null) return [];
    const record = row as Record<string, unknown>;
    return [{
      id: String(record.id ?? `${record.entreprise_id ?? 'candidature'}-${record.created_at ?? ''}`),
      user_id: typeof record.user_id === 'string' ? record.user_id : undefined,
      entreprise_id: typeof record.entreprise_id === 'number' ? record.entreprise_id : null,
      statut: typeof record.statut === 'string' ? record.statut : 'saved',
      poste: typeof record.poste === 'string' ? record.poste : 'Poste non renseigné',
      notes: typeof record.notes === 'string' ? record.notes : '',
      contact_email: typeof record.contact_email === 'string' ? record.contact_email : '',
      date_postulee: typeof record.date_postulee === 'string' ? record.date_postulee : null,
      follow_up_at: typeof record.follow_up_at === 'string' ? record.follow_up_at : null,
      company_reply: typeof record.company_reply === 'string' ? record.company_reply : '',
      replied_at: typeof record.replied_at === 'string' ? record.replied_at : null,
      cover_letter: typeof record.cover_letter === 'string' ? record.cover_letter : '',
      candidate_name: typeof record.candidate_name === 'string' ? record.candidate_name : '',
      candidate_email: typeof record.candidate_email === 'string' ? record.candidate_email : '',
      cv_bucket: typeof record.cv_bucket === 'string' ? record.cv_bucket : '',
      cv_path: typeof record.cv_path === 'string' ? record.cv_path : '',
      cv_file_name: typeof record.cv_file_name === 'string' ? record.cv_file_name : '',
      cv_content_type: typeof record.cv_content_type === 'string' ? record.cv_content_type : '',
      delivery_status: typeof record.delivery_status === 'string' ? record.delivery_status : 'draft',
      delivery_error: typeof record.delivery_error === 'string' ? record.delivery_error : '',
      sent_at: typeof record.sent_at === 'string' ? record.sent_at : null,
      created_at: typeof record.created_at === 'string' ? record.created_at : '',
      updated_at: typeof record.updated_at === 'string' ? record.updated_at : undefined,
    }];
  });
}

export function useCandidatures() {
  const [data, setData] = useState<Candidature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: rows, error: queryError } = await supabase
        .from('candidatures')
        .select('*')
        .order('created_at', { ascending: false });

      if (queryError) {
        setError(queryError.message);
        setData([]);
      } else {
        setData(parseCandidatures(rows));
      }
    } catch (err) {
      console.error('Error loading candidatures:', err);
      setError('Erreur lors du chargement des candidatures.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createCandidature = async (payload: CreateCandidaturePayload): Promise<Candidature | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Utilisateur non connecté.');
        return null;
      }

      const newRow = {
        user_id: user.id,
        entreprise_id: payload.entreprise_id,
        poste: payload.poste || 'Poste non renseigné',
        statut: payload.statut || 'applied',
        notes: payload.notes || '',
        contact_email: payload.contact_email || '',
        date_postulee: new Date().toISOString(),
      };

      const { data: inserted, error: insertError } = await supabase
        .from('candidatures')
        .insert(newRow)
        .select()
        .single();

      if (insertError) {
        console.error('Failed to create candidature:', insertError);
        setError(insertError.message);
        return null;
      }

      const createdItem: Candidature = {
        id: String(inserted.id),
        user_id: inserted.user_id,
        entreprise_id: inserted.entreprise_id,
        statut: inserted.statut,
        poste: inserted.poste,
        notes: inserted.notes,
        contact_email: inserted.contact_email,
        date_postulee: inserted.date_postulee,
        created_at: inserted.created_at,
        updated_at: inserted.updated_at,
      };

      setData((prev) => [createdItem, ...prev]);
      return createdItem;
    } catch (err) {
      console.error('Unexpected error creating candidature:', err);
      return null;
    }
  };

  const updateCandidatureStatus = async (id: string, statut: string): Promise<boolean> => {
    const previous = [...data];
    // Optimistic update
    setData((prev) =>
      prev.map((c) => (c.id === id ? { ...c, statut, updated_at: new Date().toISOString() } : c))
    );

    try {
      const { error: updateError } = await supabase
        .from('candidatures')
        .update({ statut, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (updateError) {
        console.error('Failed to update status:', updateError);
        setData(previous); // Rollback
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error updating status:', err);
      setData(previous);
      return false;
    }
  };

  const updateCandidature = async (id: string, updates: Partial<Pick<Candidature, 'statut' | 'follow_up_at' | 'company_reply' | 'replied_at' | 'cover_letter'>>): Promise<boolean> => {
    const previous = [...data];
    const payload = { ...updates, updated_at: new Date().toISOString() };
    setData((prev) => prev.map((item) => item.id === id ? { ...item, ...payload } : item));
    const { error: updateError } = await supabase.from('candidatures').update(payload).eq('id', id);
    if (updateError) {
      setData(previous);
      setError(updateError.message);
      return false;
    }
    return true;
  };

  const deleteCandidature = async (id: string): Promise<boolean> => {
    const previous = [...data];
    // Optimistic remove
    setData((prev) => prev.filter((c) => c.id !== id));

    try {
      const { error: deleteError } = await supabase
        .from('candidatures')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Failed to delete candidature:', deleteError);
        setData(previous);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error deleting candidature:', err);
      setData(previous);
      return false;
    }
  };

  return {
    data,
    loading,
    error,
    createCandidature,
    updateCandidatureStatus,
    updateCandidature,
    deleteCandidature,
    refetch: load,
  };
}
