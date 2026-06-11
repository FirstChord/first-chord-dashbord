import assert from 'node:assert/strict';
import test from 'node:test';
import { getMmsBearerToken, hasMmsBearerToken } from '../../lib/mms-token.js';

function withEnv(patch, fn) {
  const originalBearer = process.env.MMS_BEARER_TOKEN;
  const originalDefault = process.env.MMS_DEFAULT_TOKEN;
  try {
    delete process.env.MMS_BEARER_TOKEN;
    delete process.env.MMS_DEFAULT_TOKEN;
    Object.assign(process.env, patch);
    fn();
  } finally {
    if (originalBearer === undefined) delete process.env.MMS_BEARER_TOKEN;
    else process.env.MMS_BEARER_TOKEN = originalBearer;
    if (originalDefault === undefined) delete process.env.MMS_DEFAULT_TOKEN;
    else process.env.MMS_DEFAULT_TOKEN = originalDefault;
  }
}

test('getMmsBearerToken prefers MMS_BEARER_TOKEN', () => {
  withEnv({ MMS_BEARER_TOKEN: 'new-token', MMS_DEFAULT_TOKEN: 'old-token' }, () => {
    assert.equal(getMmsBearerToken(), 'new-token');
    assert.equal(hasMmsBearerToken(), true);
  });
});

test('getMmsBearerToken falls back to MMS_DEFAULT_TOKEN for legacy setups', () => {
  withEnv({ MMS_DEFAULT_TOKEN: 'old-token' }, () => {
    assert.equal(getMmsBearerToken(), 'old-token');
    assert.equal(hasMmsBearerToken(), true);
  });
});

test('getMmsBearerToken is blank when no MMS token is configured', () => {
  withEnv({}, () => {
    assert.equal(getMmsBearerToken(), '');
    assert.equal(hasMmsBearerToken(), false);
  });
});
