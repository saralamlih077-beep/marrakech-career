import test from 'node:test';
import assert from 'node:assert/strict';
import { groupOffersBySource, offerContractLabel, offerEmployerName, offerSourceLabel } from '../frontend/src/app/offerSources.ts';

const now = Date.parse('2026-10-03T12:00:00Z');
const offer = (id, source_name, extra = {}) => ({ id, source_name, expires_at: null, ...extra });

test('keeps new imported sources and existing JobSquare offers in distinct groups', () => {
  const input = [offer('j', 'Jobsquare'), offer('t1', 'Trabajo'), offer('m', 'Maremploi'), offer('t2', 'trabajo'), offer('x', 'New platform')];
  const result = groupOffersBySource(input, now);
  assert.deepEqual(result.map(group => [group.label, group.offers.map(row => row.id)]), [['Trabajo', ['t1', 't2']], ['JobSquare', ['j']], ['Maremploi', ['m']], ['New platform', ['x']]]);
  assert.equal(result.reduce((sum, group) => sum + group.offers.length, 0), input.length);
  assert.equal(offerSourceLabel(offer('j', ' jobsquare ')), 'JobSquare');
});

test('excludes expired and malformed expiration dates without hiding undated offers', () => {
  const result = groupOffersBySource([offer('old', 'Trabajo', { expires_at: '2026-10-01T00:00:00Z' }), offer('boundary', 'Trabajo', { expires_at: '2026-10-03T12:00:00Z' }), offer('invalid', 'Trabajo', { expires_at: 'unknown' }), offer('next', 'Joobaz', { expires_at: '2026-10-04T00:00:00Z' }), offer('no-date', null)], now);
  assert.deepEqual(result.flatMap(group => group.offers.map(row => row.id)), ['next', 'no-date']);
});

test('displays imported employer names without creating a fictitious directory relation', () => {
  assert.equal(offerEmployerName({ entreprise: null, employer_name: 'Royal Mansour' }), 'Royal Mansour');
  assert.equal(offerEmployerName({ entreprise: { nom: 'Nom du catalogue' }, employer_name: 'Nom source' }), 'Nom du catalogue');
  assert.equal(offerEmployerName({ entreprise: null, employer_name: null }), 'Entreprise non précisée');
});

test('does not label full-time offers as CDI and preserves full-time internship information', () => {
  assert.equal(offerContractLabel({ contract_type: 'full_time', contract_label: 'Temps plein' }), 'Temps plein');
  assert.equal(offerContractLabel({ contract_type: 'internship', contract_label: 'Temps plein' }), 'Stage · Temps plein');
  assert.equal(offerContractLabel({ contract_type: 'internship', contract_label: 'Stage' }), 'Stage');
});
