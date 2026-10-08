import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type GmailStatus = { connected: boolean; email: string | null; ready: boolean; deliveryReady: boolean };
export async function gmailRequest(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('gmail-connection', { body });
  if (error) {
    let message = 'La connexion Gmail sera disponible après l’activation du service.';
    if ('context' in error && error.context instanceof Response) {
      const result = await error.context.clone().json().catch(() => null);
      if (typeof result?.error === 'string') message = result.error;
    }
    throw new Error(message);
  }
  return data;
}
export function usePersonalGmail() {
  const [status, setStatus] = useState<GmailStatus>({ connected: false, email: null, ready: false, deliveryReady: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const popup = useRef<Window | null>(null);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const result = await gmailRequest({ action: 'status' });
      if (mounted.current) { setStatus(result); setError(''); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Connexion Gmail indisponible.'); }
    finally { if (mounted.current) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== popup.current || event.data?.type !== 'mc-gmail-connected') return;
      popup.current = null;
      if (event.data.status === 'connected') void refresh();
      else setError('La connexion n’a pas été autorisée. Réessayez et autorisez l’envoi dans Google.');
      setConnecting(false);
    };
    window.addEventListener('message', receive);
    // Google may isolate the popup with COOP. Refresh on returning to the app as well.
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    const timer = window.setInterval(() => {
      if (popup.current?.closed) { popup.current = null; setConnecting(false); void refresh(); }
    }, 1000);
    return () => { mounted.current = false; window.removeEventListener('message', receive); window.removeEventListener('focus', focus); window.clearInterval(timer); popup.current?.close(); };
  }, [refresh]);
  const connect = async (useRegistrationEmail: boolean) => {
    if (popup.current && !popup.current.closed) { popup.current.focus(); return; }
    popup.current = window.open('', 'marrakech-career-gmail', 'popup,width=520,height=650');
    if (!popup.current) { setError('Autorisez la fenêtre Google dans votre navigateur, puis réessayez.'); return; }
    setConnecting(true); setError('');
    try {
      const result = await gmailRequest({ action: 'connect', useRegistrationEmail });
      if (new URL(result.url).origin !== 'https://accounts.google.com') throw new Error('Lien de connexion invalide.');
      popup.current?.location.assign(result.url);
    } catch (e) {
      popup.current?.close(); popup.current = null; setConnecting(false);
      setError(e instanceof Error ? e.message : 'Connexion Gmail impossible.');
    }
  };
  const disconnect = async () => {
    try { await gmailRequest({ action: 'disconnect' }); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Déconnexion impossible.'); }
  };
  return { ...status, loading, connecting, error, connect, disconnect, refresh };
}
export type PersonalGmail = ReturnType<typeof usePersonalGmail>;
