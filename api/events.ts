import { collectEvents } from '../backend/events/collector.ts';

type Request = { method?: string };
type Response = { setHeader: (name: string, value: string) => void; status: (code: number) => Response; json: (body: unknown) => void; end: () => void };
type Catalog = Awaited<ReturnType<typeof collectEvents>>;
let cached: { catalog: Catalog; expires: number } | undefined;
let pending: Promise<Catalog> | undefined;

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD'); response.setHeader('Cache-Control', 'no-store');
    response.status(405).json({ error: 'Méthode non autorisée' }); return;
  }
  const catalog = cached && cached.expires > Date.now() ? cached.catalog : await (pending ||= collectEvents()).finally(() => { pending = undefined; });
  const available = catalog.sources.filter(source => source.status === 'ok').length;
  if (!available) {
    response.setHeader('Cache-Control', 'no-store'); response.status(502);
    if (request.method === 'HEAD') response.end(); else response.json({ ...catalog, error: 'Sources momentanément indisponibles' });
    return;
  }
  const ttl = available === catalog.sources.length ? 3600 : 300;
  if (cached?.catalog !== catalog) cached = { catalog, expires: Date.parse(catalog.checkedAt) + ttl * 1000 };
  // Do not restart a full CDN hour when an instance serves an older cache entry.
  const remaining = Math.max(1, Math.floor((cached.expires - Date.now()) / 1000));
  response.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  response.setHeader('Vercel-CDN-Cache-Control', `public, s-maxage=${remaining}`);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.status(200);
  if (request.method === 'HEAD') response.end(); else response.json(catalog);
}
