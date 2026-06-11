export function getMmsBearerToken() {
  return process.env.MMS_BEARER_TOKEN || process.env.MMS_DEFAULT_TOKEN || '';
}

export function hasMmsBearerToken() {
  return Boolean(getMmsBearerToken());
}
