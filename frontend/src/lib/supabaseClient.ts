import { createClient } from '@supabase/supabase-js';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL;
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabaseConfigError = !configuredUrl || !configuredAnonKey;
export const supabaseUrl = configuredUrl || 'https://configuration-required.supabase.co';
const supabaseAnonKey = configuredAnonKey || 'configuration-required';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});
