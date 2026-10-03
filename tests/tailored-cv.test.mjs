import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { emptyProfile } from '../frontend/src/types/profile.ts';
import { cvGenerationRequest, cvLayouts, parseGeneratedCv, profileToCvInput } from '../frontend/src/app/tailoredCv.ts';
import { tailoredCvPdf } from '../frontend/src/lib/tailoredCvPdf.ts';
import { validateCvPhoto } from '../frontend/src/lib/cvPhoto.ts';
import { cvPhotoFixture } from './cvPhotoFixture.mjs';

const input = { fullName: 'Candidat Test', targetRole: 'Développeur', email: 'private@example.test', phone: 'private-phone', city: 'private-city', linkedin: 'private-link', background: 'Projet universitaire React, SQL. Français courant. Stage web 2025, création de pages.' };
const company = { nom: 'Entreprise de test', domaine: 'IT', sous_domaine: 'Logiciels' };
const response = { layout: 'sidebar', palette: 'navy', summary: 'Développeur ayant réalisé un projet universitaire et un stage web.', sections: [{ kind: 'experience', title: 'Expérience', items: [{ heading: 'Stage web', subheading: '', period: '2025', bullets: ['Création de pages.'], sourceQuote: 'Stage web 2025, création de pages.' }] }, { kind: 'skills', title: 'Compétences', items: [{ heading: 'React', subheading: '', period: '', bullets: [], sourceQuote: 'Projet universitaire React, SQL.' }] }] };

test('generation sends only company and professional input, not identity or contacts', () => {
  const request = cvGenerationRequest(company, { ...input, photoDataUrl: 'PRIVATE_PHOTO_DATA' }, 'sidebar');
  assert.ok(!JSON.stringify(request).includes('PRIVATE_PHOTO_DATA'));
  assert.equal(request.previousLayout, 'sidebar');
  for (const key of ['fullName', 'email', 'phone', 'city', 'linkedin']) assert.ok(!JSON.stringify(request).includes(input[key]));
  assert.equal(request.candidate.background, input.background);
  assert.equal(cvGenerationRequest(null, input).company, null);
  const prefilled = profileToCvInput({ ...emptyProfile, full_name: 'Test', education: 'Diplôme 2025', skills: 'SQL' }, 'test@example.test');
  assert.ok(prefilled.background.includes('Diplôme 2025')); assert.ok(prefilled.background.includes('SQL'));
});
test('full AI CV accepts structured sections and retains locally supplied identity', () => {
  const cv = parseGeneratedCv({ ...response, identity: { fullName: 'Invented' } }, input);
  assert.equal(cv.identity.fullName, input.fullName); assert.equal(cv.sections[0].items[0].heading, 'Stage web');
  assert.equal(cv.layout, 'sidebar'); assert.ok(!('sourceQuote' in cv.sections[0].items[0]));
  const unicode = structuredClone(response); unicode.sections[0].items[0].sourceQuote = 'Stage web 2025 : création de pages';
  assert.doesNotThrow(() => parseGeneratedCv(unicode, input));
  unicode.sections[0].items[0].sourceQuote = 'Expérience : Stage web 2025, création de pages.';
  assert.doesNotThrow(() => parseGeneratedCv(unicode, input));
});
test('rejects unsupported design, ungrounded skills and invented proficiency levels', () => {
  assert.throws(() => parseGeneratedCv({ ...response, layout: 'unsafe-html' }, input));
  for (const change of [{ heading: 'Rust' }, { subheading: 'Expert' }, { sourceQuote: 'Invented experience' }]) {
    const modified = structuredClone(response); Object.assign(modified.sections[1].items[0], change);
    assert.throws(() => parseGeneratedCv(modified, input));
  }
  assert.throws(() => parseGeneratedCv({ ...response, sections: [...response.sections, response.sections[0]] }, input));
  assert.throws(() => parseGeneratedCv({ ...response, summary: 'Bonne maîtrise de Git et du travail en équipe.' }, input));
  assert.equal(parseGeneratedCv({ ...response, summary: 'Projet universitaire React. Bonne maîtrise de Git.' }, input).summary, 'Projet universitaire React.');
});
test('PDF preserves long main and sidebar columns across page breaks', () => {
  const cv = parseGeneratedCv(response, input);
  cv.sections[0].items[0].bullets = Array.from({ length: 130 }, (_, i) => `Experience line ${i}`); cv.sections[0].items[0].bullets.push('FINAL-MAIN-LINE');
  cv.sections[1].items = Array.from({ length: 100 }, (_, i) => ({ heading: `Skill ${i}`, subheading: '', period: '', bullets: [] })); cv.sections[1].items.push({ heading: 'FINAL-SIDEBAR-LINE', subheading: '', period: '', bullets: [] });
  const pdf = tailoredCvPdf(cv); const output = pdf.output();
  assert.ok(pdf.getNumberOfPages() >= 3); assert.ok(output.includes('FINAL-MAIN-LINE')); assert.ok(output.includes('FINAL-SIDEBAR-LINE'));
  for (const { value: layout } of cvLayouts) {
    const output = tailoredCvPdf({ ...cv, layout }).output();
    assert.ok(output.includes('FINAL-MAIN-LINE')); assert.ok(output.includes('FINAL-SIDEBAR-LINE'));
  }
});
test('five layouts preserve local photo and include it in each PDF', () => {
  const photoDataUrl = `data:image/png;base64,${cvPhotoFixture.toString('base64')}`;
  assert.equal(cvLayouts.length, 5);
  for (const { value: layout } of cvLayouts) {
    const cv = parseGeneratedCv({ ...response, layout, photoDataUrl: 'invented-photo' }, { ...input, photoDataUrl });
    assert.equal(cv.identity.photoDataUrl, photoDataUrl);
    const output = tailoredCvPdf(cv).output();
    assert.ok(output.includes('/Subtype /Image')); assert.ok(output.includes('CANDIDAT TEST') || output.includes('Candidat Test'));
  }
});
test('photo rejects unsafe/unsupported formats, empty files and oversized images', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.doesNotThrow(() => validateCvPhoto({ type, size: 1024 }));
  assert.throws(() => validateCvPhoto({ type: 'image/svg+xml', size: 20 }));
  assert.throws(() => validateCvPhoto({ type: 'image/png', size: 0 }));
  assert.throws(() => validateCvPhoto({ type: 'image/jpeg', size: 6 * 1024 * 1024 }));
});
test('dedicated function verifies user session and keeps provider credentials on server', () => {
  const backend = readFileSync(new URL('../backend/supabase/functions/generate-company-cv/index.ts', import.meta.url), 'utf8');
  assert.ok(backend.indexOf('client.auth.getUser') < backend.indexOf("fetch('https://api.groq.com"));
  assert.ok(backend.includes("Deno.env.get('GROQ_API_KEY')"));
  assert.ok(backend.includes("strict: true"));
});

test('service rejects missing/expired sessions and oversized data before calling the provider', async () => {
  const source = readFileSync(new URL('../backend/supabase/functions/generate-company-cv/index.ts', import.meta.url), 'utf8').replace(/^import .*;\r?\n/, '');
  let handler; let calls = 0; let authenticated = false;
  runInNewContext(stripTypeScriptTypes(source), { Response, AbortSignal, Deno: { env: { get: () => 'test-only' }, serve: value => { handler = value; } }, createClient: () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'test' } : null }, error: authenticated ? null : new Error('expired') }) } }), fetch: async () => { calls++; return Response.json({}); } });
  assert.equal((await handler(new Request('https://example.test', { method: 'POST' }))).status, 401);
  const request = body => new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer test-only', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await handler(request(cvGenerationRequest(company, input)))).status, 401);
  authenticated = true;
  assert.equal((await handler(request(cvGenerationRequest(company, { ...input, background: 'x'.repeat(10001) })))).status, 400);
  assert.equal((await handler(new Request('https://example.test', { method: 'GET' }))).status, 405);
  assert.equal(calls, 0);
  assert.equal((await handler(request(cvGenerationRequest(null, input)))).status, 502);
  assert.equal(calls, 1);
});
