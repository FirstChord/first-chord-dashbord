export function shouldRetryGithubRegistryUpdate({ status, errorBody = '' }) {
  return status === 409 || /sha/i.test(errorBody);
}

export function hasGithubRegistryWriteAccess(permissions = {}) {
  return Boolean(
    permissions.push
    || permissions.admin
    || permissions.maintain,
  );
}
