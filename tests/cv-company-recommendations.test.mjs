import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendCompaniesForCv } from '../frontend/src/app/cvCompanyRecommendations.ts';

const company = (id, nom, domaine, categorie = null) => ({ id, nom, domaine, sous_domaine: null, categorie, note: 5 });
const companies = [company(1, 'Agence web', 'IT & Digital'), company(2, 'Clinique', 'Santé'), company(3, 'Fiduciaire', 'Services aux entreprises', 'Comptable'), company(4, 'Hôtel', 'Tourisme & Hôtellerie'), company(5, 'Société sans activité connue', null)];

test('recommends relevant real companies from the uploaded CV and explains its evidence', () => {
  const result = recommendCompaniesForCv(companies, 'Développeur junior : React, JavaScript et SQL.', ['React', 'JavaScript', 'SQL']);
  assert.deepEqual(result.map(item => item.company.id), [1]);
  assert.ok(result[0].evidence.includes('React'));
  assert.equal(result[0].company, companies[0]);
});

test('replacing an IT CV with a healthcare CV replaces the recommendations', () => {
  const result = recommendCompaniesForCv(companies, 'Infirmière diplômée. Expérience en soins infirmiers.', ['Soins infirmiers', 'React']);
  assert.deepEqual(result.map(item => item.company.id), [2]);
  assert.ok(!result[0].evidence.includes('React'));
});

test('ignores hallucinated skills, contact fragments and employer ratings', () => {
  assert.deepEqual(recommendCompaniesForCv(companies, 'Nom : Sara. Email : sara@digital.example. Excel et français.', ['Python']), []);
  assert.deepEqual(recommendCompaniesForCv(companies, 'Contact : python@example.test, https://example.test/React. Français.', ['Python', 'React']), []);
  assert.deepEqual(recommendCompaniesForCv(companies, '', ['React']), []);
  assert.deepEqual(recommendCompaniesForCv(companies, 'Bonjour.', []), []);
});

test('uses professional categories and accent-insensitive terms instead of company names', () => {
  const result = recommendCompaniesForCv([...companies, company(6, 'Comptabilité Informatique', null)], 'Diplôme de comptabilite. Audit et fiscalité.', ['Audit']);
  assert.deepEqual(result.map(item => item.company.id), [3]);
  assert.ok(result[0].evidence.includes('Comptabilité'));
});

test('does not match short technology strings inside unrelated words', () => {
  assert.deepEqual(recommendCompaniesForCv(companies, 'Excellente créativité et hospitalité.', []), []);
  assert.deepEqual(recommendCompaniesForCv(companies, 'Développement en C++ et C#.', ['C++', 'C#']).map(item => item.company.id), [1]);
});

test('limits results, deduplicates companies and keeps order stable', () => {
  const records = Array.from({ length: 12 }, (_, i) => company(i + 20, `Entreprise ${i}`, 'IT & Digital'));
  const result = recommendCompaniesForCv([...records, records[0]], 'Python et SQL.', ['Python']);
  assert.equal(result.length, 6);
  assert.equal(new Set(result.map(item => item.company.id)).size, 6);
  assert.deepEqual(result, recommendCompaniesForCv([...records, records[0]], 'Python et SQL.', ['Python']));
  assert.deepEqual(recommendCompaniesForCv(records, 'Python', [], 0), []);
});
