import { useCallback, useEffect, useState } from 'react';
import { parseEventCatalog, type MoroccoEvent } from '../app/moroccoEvents';

export function useMoroccoEvents() {
  const [events, setEvents] = useState<MoroccoEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    void fetch('/events/catalog.json', { signal: controller.signal, cache: 'no-cache' }).then(async response => {
      if (!response.ok) throw new Error('Catalogue indisponible');
      const payload = await response.json();
      const rows = parseEventCatalog(payload);
      if (payload.events.length > 0 && rows.length === 0) throw new Error('Catalogue invalide');
      if (!controller.signal.aborted) setEvents(rows);
    }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  return { events, loading, error, retry };
}
