import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { readProfileAvatar, persistProfileAvatar } from '../frontend/src/lib/profileAvatar.ts';

function account(metadata = {}) {
  let updates = 0;
  const user = { id: 'test-account', user_metadata: { ...metadata } };
  const auth = {
    getUser: async () => ({ data: { user: structuredClone(user) }, error: null }),
    updateUser: async ({ data }) => {
      updates++;
      Object.assign(user.user_metadata, data);
      return { data: { user: structuredClone(user) }, error: null };
    },
  };
  return { auth, user, updates: () => updates };
}

test('first visit has no avatar, and each choice persists across fresh account reads', async () => {
  for (const choice of ['girl', 'boy']) {
    const fixture = account({ full_name: 'Test', favorite_company_ids: [1] });
    assert.equal(readProfileAvatar(fixture.user.user_metadata), null);
    assert.equal(await persistProfileAvatar(fixture.auth, choice), choice);
    const reloaded = await fixture.auth.getUser();
    assert.equal(readProfileAvatar(reloaded.data.user.user_metadata), choice);
    assert.equal(reloaded.data.user.user_metadata.full_name, 'Test');
    assert.deepEqual(reloaded.data.user.user_metadata.favorite_company_ids, [1]);
  }
});

test('an existing avatar is retained and cannot be overwritten by a repeated selection', async () => {
  const fixture = account({ profile_avatar: 'girl' });
  assert.equal(await persistProfileAvatar(fixture.auth, 'boy'), 'girl');
  assert.equal(fixture.updates(), 0);
});

test('failed saves and expired sessions leave the first-choice question available', async () => {
  const fixture = account();
  fixture.auth.updateUser = async () => ({ data: { user: null }, error: new Error('offline') });
  await assert.rejects(persistProfileAvatar(fixture.auth, 'boy'), /pas été enregistré/);
  assert.equal(readProfileAvatar(fixture.user.user_metadata), null);
  fixture.auth.getUser = async () => ({ data: { user: null }, error: new Error('expired') });
  await assert.rejects(persistProfileAvatar(fixture.auth, 'girl'), /Reconnectez/);
});

test('ignores unknown choices and rejects unsupported uploads or arbitrary image URLs', async () => {
  for (const value of [null, undefined, 'other', 'https://example.test/avatar.png']) {
    assert.equal(readProfileAvatar({ profile_avatar: value }), null);
  }
  const fixture = account();
  await assert.rejects(persistProfileAvatar(fixture.auth, 'other'), /Choisissez/);
  assert.equal(fixture.updates(), 0);
});

test('profile restores the selected avatar after reconnecting and clears it on logout', () => {
  const hook = readFileSync(new URL('../frontend/src/hooks/useProfile.ts', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  const states = []; let authCallback; let render; let cursor = 0;
  const context = {
    emptyProfile: {}, readProfileAvatar, persistProfileAvatar,
    supabase: { auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: callback => { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    } },
    useState: initial => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = value; }];
    },
    useRef: () => ({ current: '' }), useCallback: callback => callback,
    useEffect: callback => callback(),
    window: { addEventListener() {}, removeEventListener() {}, setTimeout() {} },
    console,
  };
  runInNewContext(stripTypeScriptTypes(hook.replace('export function useProfile', 'function useProfile')) + '\nthis.render = useProfile;', context);
  render = () => { cursor = 0; return context.render(); };
  assert.equal(render().avatarChoice, null);
  authCallback('SIGNED_IN', { user: { id: 'first', user_metadata: { profile_avatar: 'girl' } } });
  assert.equal(render().avatarChoice, 'girl');
  authCallback('SIGNED_OUT', null);
  assert.equal(render().avatarChoice, null);
  authCallback('SIGNED_IN', { user: { id: 'second', user_metadata: { profile_avatar: 'boy' } } });
  assert.equal(render().avatarChoice, 'boy');
});
