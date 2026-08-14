import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [pageSource, viewSource] = await Promise.all([
  readFile(new URL('../../app/admin/finance/page.js', import.meta.url), 'utf8'),
  readFile(new URL('../../components/finance/AdminFinanceView.js', import.meta.url), 'utf8'),
]);

test('the finance card receives the locked forecast method', () => {
  assert.match(pageSource, /method: openForecastRow\.method/u);
  assert.match(viewSource, /usedEarlierPauseModel/u);
});

test('the open forecast is labelled as a frozen historical test', () => {
  assert.match(viewSource, /Original prediction for/u);
  assert.match(viewSource, /predicted to bill/u);
  assert.match(viewSource, /It is not recalculated, so the comparison stays honest/u);
  assert.match(viewSource, /The current model now uses structured pause return dates/u);
  assert.match(viewSource, /Why this number stays frozen/u);
});
