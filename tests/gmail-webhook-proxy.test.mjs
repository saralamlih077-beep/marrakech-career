import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebhookProxy, webhookPath } from '../backend/n8n/webhook-proxy.mjs';

const job = { jobId: '11111111-1111-4111-8111-111111111111', dispatchToken: 'x'.repeat(43) };
const headers = { 'Content-Type': 'application/json', 'x-marrakech-career-secret': 'test'.repeat(10) };
async function withProxy(fetcher, run) {
  const server = createWebhookProxy({ fetcher });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('Only the application POST webhook can reach n8n', async () => {
  let calls = 0;
  await withProxy(async () => { calls++; return new Response('', { status: 200 }); }, async base => {
    for (const path of ['/', '/signin', '/rest/workflows', '/webhook/other', webhookPath + '?extra=1']) {
      assert.equal((await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(job) })).status, 404);
    }
    assert.equal((await fetch(base + webhookPath)).status, 404);
    assert.equal(calls, 0);
  });
});
test('Valid dispatch forwards only the limited payload to the fixed local n8n route', async () => {
  await withProxy(async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:5678' + webhookPath);
    assert.deepEqual(JSON.parse(options.body), job);
    assert.deepEqual(Object.keys(options.headers).sort(), ['Content-Type', 'x-marrakech-career-secret'].sort());
    assert.equal(options.redirect, 'error');
    return new Response('', { status: 200 });
  }, async base => {
    const response = await fetch(base + webhookPath, { method: 'POST', headers: { ...headers, Authorization: 'must-not-forward' }, body: JSON.stringify(job) });
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { accepted: true });
  });
});
test('Missing auth, unexpected personal fields and oversized bodies never dispatch', async () => {
  let calls = 0;
  await withProxy(async () => { calls++; return new Response('', { status: 200 }); }, async base => {
    assert.equal((await fetch(base + webhookPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job) })).status, 401);
    assert.equal((await fetch(base + webhookPath, { method: 'POST', headers, body: JSON.stringify({ ...job, email: 'test@example.invalid' }) })).status, 400);
    assert.equal((await fetch(base + webhookPath, { method: 'POST', headers, body: 'x'.repeat(2048) })).status, 413);
    assert.equal(calls, 0);
  });
});
test('Rejected upstream auth and upstream errors never report acceptance', async () => {
  for (const status of [401, 500]) {
    await withProxy(async () => new Response('private response', { status }), async base => {
      const response = await fetch(base + webhookPath, { method: 'POST', headers, body: JSON.stringify(job) });
      assert.equal(response.status, status === 401 ? 401 : 503);
      assert.equal(JSON.stringify(await response.json()).includes('private response'), false);
    });
  }
});
