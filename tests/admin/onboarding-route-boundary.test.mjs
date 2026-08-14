import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const routeSource = await readFile(
  new URL('../../app/api/admin/onboard/route.js', import.meta.url),
  'utf8',
);
const preflightRouteSource = await readFile(
  new URL('../../app/api/admin/onboard/preflight/route.js', import.meta.url),
  'utf8',
);
const formSource = await readFile(
  new URL('../../components/admin/AdminOnboardForm.js', import.meta.url),
  'utf8',
);

test('onboarding verifies the registry write path before the first canonical write', () => {
  const registryPreflight = routeSource.indexOf('await assertRegistryWriteAvailable()');
  const firstCanonicalWrite = routeSource.indexOf('const primaryRecord = await appendCanonicalStudent');

  assert.notEqual(registryPreflight, -1);
  assert.notEqual(firstCanonicalWrite, -1);
  assert.ok(registryPreflight < firstCanonicalWrite);
  assert.match(routeSource, /No Students row was written because registry preflight failed/);
});

test('onboarding preserves an explicit registry-after-Sheets partial failure', () => {
  assert.match(routeSource, /registryError\.onboardingStage = 'registryWrite'/);
  assert.match(routeSource, /error\.onboardingStage === 'registryWrite'/);
  assert.match(routeSource, /'sheetsWrite',\s*'succeeded'/);
  assert.match(routeSource, /'registryWrite', 'failed'/);
});

test('post-onboarding closeout waits for core readiness, not ancillary cleanup', () => {
  assert.match(routeSource, /const postOnboardingReady = isOnboardingCoreOperationallyComplete\(\{ steps \}\)/);
  assert.match(routeSource, /Waiting status remains open because the canonical record or core MMS lesson setup is incomplete/);
  assert.match(routeSource, /First-lesson check-in was not queued because the canonical record or core MMS lesson setup is incomplete/);
  assert.match(routeSource, /Student notes privacy follow-up was not queued because the canonical record or core MMS lesson setup is incomplete/);
});

test('preflight and UI surface partial work as a human summary with technical recovery detail', () => {
  assert.match(preflightRouteSource, /Use the SHEETS ONLY recovery action; do not rerun onboarding/);
  assert.match(preflightRouteSource, /\{ status: 503 \}/);
  assert.match(formSource, /Onboarding needs attention/);
  assert.match(formSource, /The finished steps have been saved/);
  assert.match(formSource, /Technical details/);
  assert.match(formSource, /result\.recoveryGuidance/);
});
