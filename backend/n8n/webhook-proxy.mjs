// Expose only the application webhook; the n8n editor remains local.
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

export const webhookPath = '/webhook/marrakech-career-personal-gmail';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const capabilityPattern = /^[A-Za-z0-9_-]{43}$/;

export function createWebhookProxy({ upstream = 'http://127.0.0.1:5678', fetcher = fetch } = {}) {
  const target = new URL(webhookPath, upstream).href;
  return createServer({ requestTimeout: 5000, headersTimeout: 5000 }, async (request, response) => {
    const reply = (status, body = { error: 'Request rejected' }) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(body));
    };
    if (request.method !== 'POST' || request.url !== webhookPath) {
      request.resume(); reply(404); return;
    }
    const secret = request.headers['x-marrakech-career-secret'];
    if (typeof secret !== 'string' || secret.length < 32 || secret.length > 256) {
      request.resume(); reply(401); return;
    }
    if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) {
      request.resume(); reply(415); return;
    }
    if (Number(request.headers['content-length'] || 0) > 1024) {
      request.resume(); reply(413); return;
    }
    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of request) {
        size += chunk.length;
        if (size <= 1024) chunks.push(chunk);
      }
      if (size > 1024) { reply(413); return; }
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!input || !uuidPattern.test(input.jobId || '') || !capabilityPattern.test(input.dispatchToken || '') ||
          Object.keys(input).some(key => !['jobId', 'dispatchToken'].includes(key))) {
        reply(400); return;
      }
      const result = await fetcher(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-marrakech-career-secret': secret },
        body: JSON.stringify({ jobId: input.jobId, dispatchToken: input.dispatchToken }),
        redirect: 'error', signal: AbortSignal.timeout(5000),
      });
      if (result.ok) reply(202, { accepted: true });
      else reply(result.status === 401 || result.status === 403 ? 401 : 503);
    } catch {
      reply(503);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createWebhookProxy();
  server.listen(5679, '127.0.0.1', () => console.log('Application webhook proxy listening on 127.0.0.1:5679'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
