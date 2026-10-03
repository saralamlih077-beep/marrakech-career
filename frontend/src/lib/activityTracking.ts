import { supabase } from './supabaseClient';

type ActivityType = 'session_start' | 'cv_view' | 'offer_view';
const pending = new Set<string>();

export async function trackActivity(type: ActivityType) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const key = `marrakech-career-activity:${session.user.id}:${type}`;
    const previous = Number(window.sessionStorage.getItem(key) || 0);
    const delay = type === 'session_start' ? 30 * 60 * 1000 : 5000;
    if (pending.has(key) || Date.now() - previous < delay) return;
    pending.add(key);
    try {
      const { error } = await supabase.from('user_activity_events').insert({ id: crypto.randomUUID(), event_type: type });
      if (!error) window.sessionStorage.setItem(key, String(Date.now()));
    } finally {
      pending.delete(key);
    }
  } catch {
    // Analytics must never block navigation or authentication.
  }
}
