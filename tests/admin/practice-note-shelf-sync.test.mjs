import assert from 'node:assert/strict';
import test from 'node:test';

// The tutor name that reaches Song_Assignments. `acting_tutor` on a practice
// note is a label built for that log's audit column ("Self-attested: Calum"),
// not a name. It reached assigned_by once and split one real tutor into two
// identities across every cross-song view; `assigned_via = note` is what
// carries the self-attested caveat, so the name column holds a plain name.
//
// The stripping rule is asserted directly here rather than through the sheets
// adapter, which would need a live spreadsheet.
const stripSelfAttestedLabel = (value = '') => `${value || ''}`.trim().replace(/^Self-attested:\s*/iu, '');

test('a self-attested label is reduced to the tutor name', () => {
  assert.equal(stripSelfAttestedLabel('Self-attested: Calum'), 'Calum');
  assert.equal(stripSelfAttestedLabel('Self-attested: Calum Steel'), 'Calum Steel');
});

test('the prefix is matched however it is cased or spaced', () => {
  assert.equal(stripSelfAttestedLabel('self-attested:  Tom'), 'Tom');
  assert.equal(stripSelfAttestedLabel('SELF-ATTESTED: Tom'), 'Tom');
});

test('an ordinary tutor name passes through untouched', () => {
  assert.equal(stripSelfAttestedLabel('Calum Steel'), 'Calum Steel');
  assert.equal(stripSelfAttestedLabel('  Dean  '), 'Dean');
  assert.equal(stripSelfAttestedLabel(''), '');
});

test('a name that merely mentions the words is not mangled', () => {
  assert.equal(stripSelfAttestedLabel('Selfridge'), 'Selfridge');
});
