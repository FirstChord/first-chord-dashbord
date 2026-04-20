export function shouldRetryGithubRegistryUpdate({ status, errorBody = '' }) {
  return status === 409 || /sha/i.test(errorBody);
}
