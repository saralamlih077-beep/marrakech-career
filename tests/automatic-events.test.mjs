import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_SOURCES, collectEvents, deduplicateEvents, parseDateRange, parseSource, robotsAllows, robotsDelay } from '../backend/events/collector.ts';
import { parseEventCatalog } from '../frontend/src/app/moroccoEvents.ts';
import handler from '../api/events.ts';

const source = id => EVENT_SOURCES.find(source => source.id === id);
const forum = (city, dates, title = "Forum International de l'Etudiant") => `<div><h5>${title}</h5><p>${dates}</p><p>Salle annoncée - <span>${city}</span></p><p>09h–18h</p></div>`;
const salon = (city, dates, title, url, topics = ['Cybersécurité']) => `<div><div><div><span>🇲🇦 ${city}</span></div><span>${dates}</span></div><h3>${title}</h3><p>Lieu annoncé</p><div>${topics.map(topic => `<span>${topic}</span>`).join('')}</div><a href="${url}">Site officiel</a></div>`;
const pages = {
  etudiant: forum('Rabat', 'mardi 19 janv. 2027 - mercredi 20 janv. 2027'),
  gitex: '<html><head><title>GITEX 2026</title></head><body>Marrakech 26–28 April 2027</body></html>',
  siam: '<html><head><title>SIAM 2026</title></head><body>DU 19 AU 27 AVRIL 2027 Meknès</body></html>',
  logismed: '<body>11-12-13 Mai 2027 Foire internationale de Casablanca</body>',
  siema: '<body><div class="banner-info">7-9 September 2027, AMDIE (OFEC) Casablanca, Morocco</div></body>',
  airshow: '<body>Marrakech OCTOBER 7–10, 2026</body>',
  ctcim: salon('Casablanca', '30 octobre – 4 novembre 2026', 'Nouveau salon numérique', 'https://example.ma/edition'),
};

test('explicit dates support source languages and ranges without guessing years', () => {
  const cases = [
    ['mardi 19 janv. 2027 - mercredi 20 janv. 2027', '2027-01-19', '2027-01-20'],
    ['26–28 April 2027', '2027-04-26', '2027-04-28'],
    ['DU 19 AU 27 AVRIL 2027', '2027-04-19', '2027-04-27'],
    ['11-12-13 Mai 2027', '2027-05-11', '2027-05-13'],
    ['OCTOBER 7–10, 2026', '2026-10-07', '2026-10-10'],
    ['30 octobre – 4 novembre 2026', '2026-10-30', '2026-11-04'],
    ['31 décembre 2026 - 2 janvier 2027', '2026-12-31', '2027-01-02'],
  ];
  for (const [text, startDate, endDate] of cases) assert.deepEqual(parseDateRange(text), { startDate, endDate }, text);
  for (const text of ['7–10 octobre', '30 février 2027', '10–7 octobre 2026', '9–31 février 2027']) assert.equal(parseDateRange(text), null, text);
});

test('sources discover new cards, changes of date and edition, ignoring stale titles', () => {
  for (const item of EVENT_SOURCES) assert.equal(parseSource(item, pages[item.id], '2026-10-07').length, 1, item.id);
  const html = pages.etudiant + forum('Marrakech', '22-24 mars 2027') + forum('Paris', '22 mars 2027');
  const rows = parseSource(source('etudiant'), html, '2026-10-07');
  assert.equal(rows.length, 2);
  assert.equal(rows[1].city, 'Marrakech');
  assert.equal(rows[1].venue, 'Salle annoncée');
  assert.equal(parseSource(source('siam'), pages.siam, '2026-10-07')[0].startDate, '2027-04-19');
  const changed = parseSource(source('etudiant'), forum('Rabat', '20-21 janv. 2028'), '2026-10-07')[0];
  assert.equal(changed.startDate, '2028-01-20');
  assert.notEqual(changed.id, rows[0].id);
  assert.equal(parseSource(source('ctcim'), pages.ctcim + salon('Agadir', '5-6 novembre 2026', 'Nouvel événement', 'https://example2.ma'), '2026-10-07').length, 2);
});

test('past events disappear and source layout failures are distinct from empty futures', () => {
  assert.equal(parseSource(source('airshow'), pages.airshow, '2026-10-10').length, 1);
  assert.equal(parseSource(source('airshow'), pages.airshow, '2026-10-11').length, 0);
  assert.throws(() => parseSource(source('etudiant'), '<h1>Page indisponible</h1>', '2026-10-07'));
  assert.throws(() => parseSource(source('ctcim'), salon('Paris', '5 novembre 2026', 'Salon étranger', 'https://example.fr'), '2026-10-07'));
  assert.throws(() => parseSource(source('ctcim'), salon('Rabat', '5 novembre 2026', 'Salon annulé', 'https://example.ma'), '2026-10-07'));
  const row = parseSource(source('ctcim'), pages.ctcim, '2026-10-07')[0];
  assert.equal(parseEventCatalog({ events: [row] }).length, 1);
  assert.equal(parseEventCatalog({ events: [{ ...row, registrationUrl: 'javascript:alert(1)' }] }).length, 0);
});

test('official organizer announcements win over duplicates from a directory', () => {
  const official = parseSource(source('airshow'), pages.airshow, '2026-10-07')[0];
  const duplicate = parseSource(source('ctcim'), salon('Marrakech', '7 octobre – 10 octobre 2026', 'Marrakech Airshow 2026', source('airshow').url), '2026-10-07')[0];
  for (const order of [[official, duplicate], [duplicate, official]]) assert.deepEqual(deduplicateEvents(order), [official]);
});

test('collector honors robots rules including specific agents, wildcards and longest match', () => {
  assert.equal(robotsAllows('User-agent: *\nDisallow: /', '/forums-salons'), false);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /\nAllow: /forums-salons', '/forums-salons'), true);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /*secret*', '/my-secret-page'), false);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /foo$','/foobar'), true);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /\nUser-agent: MarrakechCareerEvents\nAllow: /','/foo'), true);
  assert.equal(robotsAllows('User-agent: *\nDisallow:', '/foo'), true);
  assert.equal(robotsDelay('User-agent: *\nCrawl-delay: 10'), 10000);
  assert.equal(robotsDelay('User-agent: *\nCrawl-delay: 10\nUser-agent: OtherBot\nCrawl-delay: 99'), 10000);
  assert.equal(robotsDelay('User-agent: *\nCrawl-delay: 10\nUser-agent: MarrakechCareerEvents\nCrawl-delay: 1'), 1000);
});

test('partial failures keep real results and report source availability without following arbitrary redirects', async () => {
  const requests = [];
  const fetcher = async url => {
    requests.push(url);
    if (url.endsWith('robots.txt')) return new Response(url.includes('etudiant.ma') ? 'User-agent: *\nDisallow: /' : '', { status: 200 });
    if (url.includes('logismed')) return new Response('', { status: 302, headers: { location: 'https://127.0.0.1/internal' } });
    if (url.includes('siemamaroc')) return new Response('x'.repeat(2_000_001), { status: 200 });
    const item = EVENT_SOURCES.find(source => source.url === url);
    return new Response(item?.id === 'ctcim' ? '<body>Layout changed</body>' : pages[item?.id], { status: 200 });
  };
  const catalog = await collectEvents({ now: new Date('2026-10-07T12:00:00Z'), fetcher });
  assert.equal(catalog.mode, 'automatic');
  assert.equal(catalog.events.length, 3);
  assert.deepEqual(catalog.sources.filter(source => source.status === 'unavailable').map(source => source.id), ['etudiant', 'logismed', 'siema', 'ctcim']);
  assert.ok(!requests.includes(source('etudiant').url));
  assert.ok(!requests.some(url => url.includes('127.0.0.1')));
  assert.equal(parseEventCatalog(catalog).length, catalog.events.length);
});

test('API rejects writes, shares collection requests, expires cache and never caches complete failures', async () => {
  const previousFetch = globalThis.fetch, previousNow = Date.now;
  let clock = previousNow(), requests = 0, fail = false;
  Date.now = () => clock;
  globalThis.fetch = async url => {
    requests++;
    if (fail) return new Response('', { status: 503 });
    if (url.endsWith('robots.txt')) return new Response('User-agent: *\nAllow: /', { status: 200 });
    return new Response(pages[EVENT_SOURCES.find(source => source.url === url)?.id].replace(/2026/g, '2098').replace(/2027/g, '2099'), { status: 200 });
  };
  const response = () => ({ headers: {}, code: 0, body: undefined, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; }, end() {} });
  try {
    const post = response(); await handler({ method: 'POST' }, post); assert.equal(post.code, 405); assert.equal(requests, 0);
    const first = response(), second = response();
    await Promise.all([handler({ method: 'GET' }, first), handler({ method: 'GET' }, second)]);
    assert.equal(requests, 14); assert.equal(first.code, 200); assert.equal(first.body.events.length, 7);
    assert.equal(first.body.checkedAt, second.body.checkedAt);
    clock += 1800000;
    const cached = response(); await handler({ method: 'HEAD' }, cached);
    assert.equal(requests, 14); assert.equal(cached.body, undefined);
    assert.ok(Number(cached.headers['Vercel-CDN-Cache-Control'].match(/s-maxage=(\d+)/)[1]) <= 1800);
    clock += 3600000; fail = true;
    const failed = response(); await handler({ method: 'GET' }, failed);
    assert.equal(failed.code, 502); assert.equal(failed.headers['Cache-Control'], 'no-store');
    assert.equal(failed.headers['Vercel-CDN-Cache-Control'], undefined);
    const recovery = response(); fail = false; await handler({ method: 'GET' }, recovery); assert.equal(recovery.code, 200);
  } finally { globalThis.fetch = previousFetch; Date.now = previousNow; }
});
