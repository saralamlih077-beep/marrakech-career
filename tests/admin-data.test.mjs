import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { registrationSeries } from '../frontend/src/app/adminRegistrationSeries.ts';
import { userDirectoryCsv } from '../frontend/src/app/adminUserExport.ts';

test('daily registrations use Marrakech dates, include empty days and exclude future dates', () => {
  const points = registrationSeries([
    { createdAt: '2026-10-02T23:30:00Z' },
    { createdAt: '2026-10-03T10:00:00Z' },
    { createdAt: '2026-10-03T13:00:00Z' },
    { createdAt: 'invalid' },
    { createdAt: '2026-08-01T12:00:00Z' },
  ], 'day', new Date('2026-10-03T12:00:00Z'));
  assert.equal(points.length, 30);
  assert.equal(points.at(-1).key, '2026-10-03');
  assert.equal(points.at(-1).value, 2);
  assert.equal(points.reduce((sum, point) => sum + point.value, 0), 2);
  assert.equal(points.at(-2).value, 0);
});

test('weekly registrations separate Sunday from Monday and preserve annual boundaries', () => {
  const points = registrationSeries([
    { createdAt: '2025-12-28T12:00:00Z' },
    { createdAt: '2025-12-29T12:00:00Z' },
    { createdAt: '2026-01-01T12:00:00Z' },
  ], 'week', new Date('2026-01-04T12:00:00Z'));
  assert.equal(points.length, 12);
  assert.equal(points.at(-1).key, '2025-12-29');
  assert.equal(points.at(-1).value, 2);
  assert.equal(points.at(-2).value, 1);
});

test('monthly registrations count the first and last days correctly across years', () => {
  const points = registrationSeries([
    { createdAt: '2025-12-15T12:00:00Z' },
    { createdAt: '2025-12-31T23:30:00Z' },
    { createdAt: '2026-01-02T12:00:00Z' },
  ], 'month', new Date('2026-01-03T12:00:00Z'));
  assert.equal(points.length, 12);
  assert.equal(points.at(-1).key, '2026-01-01');
  assert.equal(points.at(-1).value, 2);
  assert.equal(points.at(-2).value, 1);
});

test('CSV export preserves accented names and counts, escapes quotes and neutralizes formulas', () => {
  const csv = userDirectoryCsv([{ fullName: '=HYPERLINK("bad")', email: 'élève@example.com', createdAt: '2026-10-01', applicationCount: 4, sentApplicationCount: 2, emailConfirmedAt: null }]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"élève@example.com"'));
  assert.ok(csv.includes(';"4";"2";"À confirmer"'));
});

const backend = stripTypeScriptTypes((await readFile(new URL('../backend/supabase/functions/admin-analytics/index.ts', import.meta.url), 'utf8'))
  .replace("import { createClient } from 'npm:@supabase/supabase-js@2';", ''));

function handlerFor({ authorized = true, authenticated = true, users = [], tables = {}, now } = {}) {
  const calls = [];
  const service = {
    auth: {
      getUser: async () => ({ data: { user: authenticated ? { email: authorized ? 'admin@example.com' : 'candidate@example.com' } : null }, error: null }),
      admin: { listUsers: async ({ page, perPage }) => {
        calls.push(['users', page]);
        return { data: { users: users.slice((page - 1) * perPage, page * perPage) }, error: null };
      } },
    },
    from: table => {
      calls.push(['table', table]);
      const query = {
        select: () => query,
        order: () => query,
        range: async (first, last) => { calls.push([table, first]); return { data: (tables[table] || []).slice(first, last + 1), error: null }; },
        then: resolve => resolve({ count: (tables[table] || []).length, error: null }),
      };
      return query;
    },
  };
  let handler;
  const ClockDate = now ? class extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return Date.parse(now); }
  } : Date;
  vm.runInNewContext(backend, {
    createClient: () => service,
    Deno: { env: { get: name => name === 'ADMIN_EMAILS' ? 'admin@example.com' : 'mock' }, serve: fn => { handler = fn; } },
    Response, Date: ClockDate, console,
  });
  return { handler, calls };
}

test('unauthenticated and ordinary accounts cannot read administrative user data', async () => {
  for (const config of [{ authenticated: false }, { authorized: false }]) {
    const { handler, calls } = handlerFor(config);
    const response = await handler(new Request('https://example.com', { method: 'POST', headers: { authorization: 'Bearer mock' } }));
    assert.equal(response.status, config.authenticated === false ? 401 : 403);
    assert.equal(calls.length, 0);
  }
  const { handler, calls } = handlerFor();
  assert.equal((await handler(new Request('https://example.com', { method: 'POST' }))).status, 401);
  assert.equal(calls.length, 0);
});

test('activity counts distinct accounts, separates new and existing users and leaves untracked history unknown', async () => {
  const { handler } = handlerFor({ now: '2026-10-03T12:00:00Z', users: [
    { id: 'old', created_at: '2026-08-01T12:00:00Z', user_metadata: {} },
    { id: 'new', created_at: '2026-10-02T12:00:00Z', user_metadata: {} },
  ], tables: {
    analytics_tracking_settings: [{ key: 'activity', started_at: '2026-10-01T12:00:00Z' }, { key: 'application_status', started_at: '2026-10-01T12:00:00Z' }],
    user_activity_events: [
      { user_id: 'old', event_type: 'session_start', occurred_at: '2026-10-01T13:00:00Z' },
      { user_id: 'old', event_type: 'cv_view', occurred_at: '2026-10-01T14:00:00Z' },
      { user_id: 'new', event_type: 'offer_view', occurred_at: '2026-10-02T13:00:00Z' },
    ],
    candidatures: [{ user_id: 'old', statut: 'interview', created_at: '2026-09-10T12:00:00Z' }],
    candidature_status_events: [{ statut: 'interview', occurred_at: '2026-10-02T13:00:00Z' }],
  } });
  const result = await (await handler(new Request('https://example.com', { method: 'POST', headers: { authorization: 'Bearer mock' } }))).json();
  assert.equal(result.engagement.month.at(-1).activeUsers, 2);
  assert.equal(result.engagement.month.at(-1).newUsers, 1);
  assert.equal(result.engagement.month.at(-1).returningUsers, 1);
  assert.equal(result.engagement.month.at(-1).cvViews, 1);
  assert.equal(result.engagement.month.at(-1).offerViews, 1);
  assert.equal(result.engagement.month.at(-2).activeUsers, null);
  assert.equal(result.applicationTrends.month.at(-2).registered, 1);
  assert.equal(result.applicationTrends.month.at(-2).interviews, null);
  assert.equal(result.applicationTrends.month.at(-1).interviews, 1);
});

test('skill coverage uses verified offers and distinct skills, and blank fields do not complete a profile', async () => {
  const { handler } = handlerFor({ users: [{ id: 'a', created_at: '2026-10-01', user_metadata: {} }], tables: {
    profiles: [{ id: 'a', full_name: 'A', job_title: ' ', skills: 'SQL, sql;Python', education: '', experience: '' }],
    job_offers: [{ status: 'verified', skills: ['SQL', 'sql'] }, { status: 'verified', skills: ['Python'] }, { status: 'pending', skills: ['SQL'] }],
  } });
  const result = await (await handler(new Request('https://example.com', { method: 'POST', headers: { authorization: 'Bearer mock' } }))).json();
  assert.equal(result.users.profilesCompleted, 0);
  assert.equal(result.skills.verifiedOffers, 2);
  assert.equal(result.skills.skills.length, 2);
  assert.equal(result.skills.skills.find(item => item.skill === 'SQL').profiles, 1);
  assert.equal(result.skills.skills.find(item => item.skill === 'SQL').rate, 50);
  assert.equal(result.profileQuality.find(item => item.field === 'job_title').value, 0);
});

test('admin payload reads beyond 1,000 rows and counts registered versus sent applications per user', async () => {
  const users = Array.from({ length: 1001 }, (_, index) => ({ id: `user-${index}`, email: `user${index}@example.com`, created_at: '2026-10-01T12:00:00Z', email_confirmed_at: null, user_metadata: { full_name: `User ${index}` } }));
  const applications = Array.from({ length: 1001 }, () => ({ user_id: 'user-0', statut: 'applied' }));
  applications.push({ user_id: 'user-0', statut: 'saved' }, { user_id: 'user-1000', statut: 'interview' });
  const { handler, calls } = handlerFor({ users, tables: {
    profiles: [{ id: 'user-0', full_name: 'Actual profile', job_title: 'Developer', skills: 'SQL' }],
    candidatures: applications,
    user_feedback: [{ rating: 5 }],
  } });
  const response = await handler(new Request('https://example.com', { method: 'POST', headers: { authorization: 'Bearer mock' } }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.users.total, 1001);
  assert.equal(result.users.registeredUsers.find(user => user.id === 'user-0').fullName, 'Actual profile');
  assert.equal(result.users.registeredUsers.find(user => user.id === 'user-0').applicationCount, 1002);
  assert.equal(result.users.registeredUsers.find(user => user.id === 'user-0').sentApplicationCount, 1001);
  assert.equal(result.users.registeredUsers.find(user => user.id === 'user-1000').applicationCount, 1);
  assert.equal(result.users.registeredUsers.find(user => user.id === 'user-1').applicationCount, 0);
  assert.equal(result.activity.applications, 1003);
  assert.equal(result.users.profilesCompleted, 1);
  assert.ok(calls.some(call => call[0] === 'users' && call[1] === 2));
  assert.ok(calls.some(call => call[0] === 'candidatures' && call[1] === 1000));
});
