const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parseVersion(value) {
  const normalized = value?.startsWith("v") ? value.slice(1) : value;
  const match = normalized?.match(versionPattern);
  if (!match) return undefined;
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  if (!leftParts || !rightParts) throw new Error("A release uses an invalid semantic version.");
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

export function createUpdateChecker({
  repository = process.env.VPS_MANAGER_GITHUB_REPOSITORY ?? "",
  currentVersion,
  fetchImpl = fetch,
}) {
  if (!parseVersion(currentVersion)) throw new Error("The current VPS Manager version is invalid.");
  const normalizedRepository = repository.trim();
  if (normalizedRepository && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalizedRepository)) {
    throw new Error("VPS_MANAGER_GITHUB_REPOSITORY must use the owner/repository format.");
  }

  async function check() {
    if (!normalizedRepository) {
      return {
        configured: false,
        currentVersion,
        latestVersion: null,
        updateAvailable: false,
        updateReady: false,
        releaseUrl: null,
      };
    }

    const response = await fetchImpl(
      `https://api.github.com/repos/${normalizedRepository}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "VPS-Manager-update-checker",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) {
      throw new Error(`GitHub returned HTTP ${response.status} while checking releases.`);
    }
    const release = await response.json();
    const tag = release.tag_name;
    if (release.draft || release.prerelease || !parseVersion(tag)) {
      throw new Error("The latest GitHub release does not have a supported stable version tag.");
    }
    const updateAvailable = compareVersions(tag, currentVersion) > 0;
    const sourceArchive = release.assets?.find(
      (asset) => asset.name === "vps-manager-source.tar.gz",
    );
    const digest = sourceArchive?.digest;
    const expectedUrl = `https://github.com/${normalizedRepository}/releases/download/${encodeURIComponent(tag)}/vps-manager-source.tar.gz`;
    const updateReady = updateAvailable
      && sourceArchive?.browser_download_url === expectedUrl
      && typeof digest === "string"
      && /^sha256:[a-f0-9]{64}$/i.test(digest);

    return {
      configured: true,
      currentVersion,
      latestVersion: tag.replace(/^v/, ""),
      updateAvailable,
      updateReady,
      releaseUrl: release.html_url,
      releaseNotes: typeof release.body === "string" ? release.body.slice(0, 5000) : "",
      command: updateReady ? "sudo vps-manager-update" : null,
    };
  }

  return { check };
}
