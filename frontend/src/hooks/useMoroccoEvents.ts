import { useCallback, useEffect, useState } from 'react';
import { parseEventCatalog, type MoroccoEvent } from '../app/moroccoEvents';

type Source = { id: string; label: string; status: 'ok' | 'unavailable'; count: number };
export function useMoroccoEvents() {
  const [events, setEvents] = useState<MoroccoEvent[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') retry(); }, 10 * 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') retry(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [retry]);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort('timeout'), 35000);
    setLoading(true);
    void fetch('/api/events', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Catalogue indisponible');
      const payload = await response.json();
      const rows = parseEventCatalog(payload);
      if (payload.mode !== 'automatic' || !Array.isArray(payload.sources) || !payload.sources.length || !payload.sources.some((source: Source) => source?.status === 'ok') || !Number.isFinite(Date.parse(payload.checkedAt)) || payload.events.length > 0 && rows.length === 0) throw new Error('Catalogue invalide');
      const sources: Source[] = payload.sources.filter((source: Source) => source && typeof source.id === 'string' && typeof source.label === 'string' && ['ok', 'unavailable'].includes(source.status) && Number.isInteger(source.count) && source.count >= 0);
      if (!controller.signal.aborted) { setEvents(rows); setSources(sources); setCheckedAt(payload.checkedAt); setError(false); }
    }).catch(() => { if (!controller.signal.aborted || controller.signal.reason === 'timeout') setError(true); }).finally(() => {
      window.clearTimeout(timeout);
      if (!controller.signal.aborted || controller.signal.reason === 'timeout') setLoading(false);
    });
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [attempt]);
  return { events, sources, checkedAt, loading, error, retry };
}
