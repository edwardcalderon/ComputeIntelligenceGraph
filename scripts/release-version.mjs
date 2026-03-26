const DEFAULT_TAG_PREFIX = 'v';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildReleaseTagPattern(prefix = DEFAULT_TAG_PREFIX) {
  return new RegExp(
    `^${escapeRegExp(prefix)}(?<version>\\d+\\.\\d+\\.\\d+)(?:\\+build\\.(?<buildNumber>\\d+))?$`,
  );
}

export function normalizeReleaseTag(tag, prefix = DEFAULT_TAG_PREFIX) {
  const normalizedTag = tag.replace(/^refs\/tags\//, '');
  const match = normalizedTag.match(buildReleaseTagPattern(prefix));

  if (!match?.groups) {
    return null;
  }

  return {
    tag: normalizedTag,
    version: match.groups.version,
    buildNumber: match.groups.buildNumber ? Number(match.groups.buildNumber) : null,
  };
}

function parseReleaseVersion(version) {
  const parts = version.split('.');

  if (parts.length !== 3) {
    return null;
  }

  const [major, minor, patch] = parts.map((part) => Number(part));

  if ([major, minor, patch].some((part) => Number.isNaN(part))) {
    return null;
  }

  return { major, minor, patch };
}

function releaseTagRank(tag, prefix = DEFAULT_TAG_PREFIX) {
  const normalized = normalizeReleaseTag(tag, prefix);

  if (!normalized) {
    return null;
  }

  const version = parseReleaseVersion(normalized.version);
  if (!version) {
    return null;
  }

  return {
    ...normalized,
    ...version,
    buildNumber: normalized.buildNumber ?? 0,
  };
}

export function compareReleaseTagVersions(left, right, prefix = DEFAULT_TAG_PREFIX) {
  const leftRank = releaseTagRank(left, prefix);
  const rightRank = releaseTagRank(right, prefix);

  if (!leftRank || !rightRank) {
    throw new Error(`Cannot compare non-release tags: ${left} vs ${right}`);
  }

  for (const field of ['major', 'minor', 'patch', 'buildNumber']) {
    if (leftRank[field] > rightRank[field]) {
      return 1;
    }

    if (leftRank[field] < rightRank[field]) {
      return -1;
    }
  }

  return 0;
}

export function validateReleaseTagVersion(tag, version, prefix = DEFAULT_TAG_PREFIX) {
  const normalized = normalizeReleaseTag(tag, prefix);

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

export function validateReleaseTagFloor(tag, floorTag, prefix = DEFAULT_TAG_PREFIX) {
  if (!floorTag) {
    return {
      ok: true,
      skipped: false,
      error: null,
      floor: null,
    };
  }

  const normalized = normalizeReleaseTag(tag, prefix);
  const floorNormalized = normalizeReleaseTag(floorTag, prefix);

  if (!normalized) {
    return {
      ok: false,
      skipped: false,
      error: `Tag ${tag} is not a release tag.`,
      floor: floorNormalized,
    };
  }

  if (!floorNormalized) {
    return {
      ok: false,
      skipped: false,
      error: `Floor tag ${floorTag} is not a release tag.`,
      floor: null,
    };
  }

  if (compareReleaseTagVersions(normalized.tag, floorNormalized.tag, prefix) < 0) {
    return {
      ok: false,
      skipped: false,
      error: `Release tag ${normalized.tag} is below the current release floor ${floorNormalized.tag}.`,
      floor: floorNormalized,
    };
  }

  return {
    ok: true,
    skipped: false,
    error: null,
    floor: floorNormalized,
  };
}

export function findHighestReleaseTag(tags, prefix = DEFAULT_TAG_PREFIX) {
  let highest = '';

  for (const tag of tags) {
    if (!normalizeReleaseTag(tag, prefix)) {
      continue;
    }

    if (!highest || compareReleaseTagVersions(tag, highest, prefix) > 0) {
      highest = tag;
    }
  }

  return highest;
}

export function findHighestReleaseTagBelow(tags, floorTag, prefix = DEFAULT_TAG_PREFIX) {
  const floorNormalized = normalizeReleaseTag(floorTag, prefix);

  if (!floorNormalized) {
    return '';
  }

  let highest = '';

  for (const tag of tags) {
    if (!normalizeReleaseTag(tag, prefix)) {
      continue;
    }

    if (compareReleaseTagVersions(tag, floorNormalized.tag, prefix) >= 0) {
      continue;
    }

    if (!highest || compareReleaseTagVersions(tag, highest, prefix) > 0) {
      highest = tag;
    }
  }

  return highest;
}
