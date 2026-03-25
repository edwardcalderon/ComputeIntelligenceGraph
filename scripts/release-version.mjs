const RELEASE_TAG_PATTERN = /^v(?<version>\d+\.\d+\.\d+)(?:\+build\.(?<buildNumber>\d+))?$/;

export function normalizeReleaseTag(tag) {
  const normalizedTag = tag.replace(/^refs\/tags\//, '');
  const match = normalizedTag.match(RELEASE_TAG_PATTERN);

  if (!match?.groups) {
    return null;
  }

  return {
    tag: normalizedTag,
    version: match.groups.version,
    buildNumber: match.groups.buildNumber ? Number(match.groups.buildNumber) : null,
  };
}

export function validateReleaseTagVersion(tag, version) {
  const normalized = normalizeReleaseTag(tag);

  if (!normalized) {
    return {
      ok: false,
      skipped: false,
      error: `Tag ${tag} is not a release tag.`,
      normalized: null,
    };
  }

  if (normalized.version !== version) {
    return {
      ok: false,
      skipped: false,
      error: `Release tag ${normalized.tag} expects version ${normalized.version}, but found ${version}.`,
      normalized,
    };
  }

  return {
    ok: true,
    skipped: false,
    error: null,
    normalized,
  };
}
