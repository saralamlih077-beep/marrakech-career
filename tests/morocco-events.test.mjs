import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currentEvents, filterEvents, moroccoToday, parseEventCatalog, safeEventUrl } from '../frontend/src/app/moroccoEvents.ts';

const catalog = JSON.parse(readFileSync(new URL('../frontend/public/events/catalog.json', import.meta.url), 'utf8'));
const events = parseEventCatalog(catalog);
const filters = { query: '', domain: 'all', city: 'all', period: 'all' };
test('catalog has real dated national entries, unique identities and source links', () => {
  assert.equal(events.length, catalog.events.length);
  assert.equal(new Set(events.map(row => row.id)).size, events.length);
  assert.ok(new Set(events.map(row => row.city)).size >= 8);
  assert.ok(events.every(row => row.country === 'MA' && safeEventUrl(row.sourceUrl)));
});
test('ongoing events remain until the last Moroccan day and past events disappear', () => {
  assert.ok(currentEvents(events, '2026-10-10').some(row => row.id === 'marrakech-airshow-2026'));
  assert.ok(!currentEvents(events, '2026-10-11').some(row => row.id === 'marrakech-airshow-2026'));
  assert.equal(moroccoToday(new Date('2026-10-06T23:30:00Z')), '2026-10-07');
  assert.equal(moroccoToday(new Date('2026-02-20T23:30:00Z')), '2026-02-20');
});
test('search combines domain, city, accents and timeframe without inventing matches', () => {
  assert.deepEqual(filterEvents(events, { ...filters, query: 'IA', city: 'Marrakech', domain: 'IT & Digital' }, '2026-10-07').map(row => row.id), ['marrakech-airshow-2026', 'gitex-africa-2027']);
  assert.equal(filterEvents(events, { ...filters, query: 'batiment', city: 'El Jadida' }, '2026-10-07')[0].id, 'sib-2026');
  assert.deepEqual(filterEvents(events, { ...filters, period: '30' }, '2026-10-07').map(row => row.id), ['marrakech-airshow-2026', 'global-green-2026']);
  assert.equal(filterEvents(events, { ...filters, domain: 'Santé' }, '2026-10-07').length, 0);
  assert.equal(filterEvents(events, { ...filters, query: 'événement imaginaire' }, '2026-10-07').length, 0);
});
test('malformed, cancelled, foreign, reversed and unsafe entries are excluded', () => {
  const row = events[0];
  const invalid = [{ ...row, country: 'FR' }, { ...row, status: 'cancelled' }, { ...row, startDate: '2026-02-30' }, { ...row, endDate: '2025-01-01' }, { ...row, sourceUrl: 'javascript:alert(1)' }, { ...row, sourceUrl: 'https://user:pass@example.com/' }, { ...row, domains: ['Unknown'] }, { ...row, title: '' }];
  assert.equal(parseEventCatalog({ events: invalid }).length, 0);
  assert.equal(parseEventCatalog({ events: [row, row] }).length, 1);
  assert.equal(currentEvents([{ ...row, verifiedAt: '2026-10-08' }], '2026-10-07').length, 0);
  assert.throws(() => parseEventCatalog({ wrong: [] }));
});
