/**
 * Helpers for selecting the best js-debug asset from a GitHub release
 * and cross-platform path normalization.
 *
 * This file is ESM and intentionally contains only pure functions
 * suitable for unit testing without side effects.
 */

/**
 * Normalizes a path for display or comparison by converting backslashes to forward slashes.
 * Do not use this for actual fs operations; it is for logs and tests only.
 * @param {string} p
 * @returns {string}
 */
export function normalizePath(p) {
  return typeof p === 'string' ? p.replace(/\\+/g, '/') : '';
}

/**
 * Determines the archive type from an asset name.
 * @param {string} name
 * @returns {'tgz'|'zip'|null}
 */
function getArchiveType(name) {
  const lower = String(name).toLowerCase();
  if (lower.endsWith('.tgz') || lower.endsWith('.tar.gz')) return 'tgz';
  // Treat VSIX as a zip archive (it is a zip container)
  if (lower.endsWith('.zip') || lower.endsWith('.vsix')) return 'zip';
  return null;
}

/**
 * Selects the best js-debug asset from the provided GitHub release assets.
 * Preference order:
 *  1) Names matching /(js-debug-(server|dap).*\.(?:tar\.gz|tgz|zip|vsix))$/i
 *  2) Fallback names matching /(js-debug.*\.(?:tar\.gz|tgz|zip|vsix))$/i
 * Within any matching set, prefer archive type: .tgz/.tar.gz over .zip.
 *
 * @param {Array<{name?: string, browser_download_url?: string, url?: string, download_url?: string}>} assets
 * @returns {{ url: string, name: string, type: 'tgz' | 'zip' }}
 * @throws {Error} if no suitable asset is found
 */
export function selectBestAsset(assets) {
  const list = Array.isArray(assets) ? assets : [];
  // Accept .tgz/.tar.gz/.zip and .vsix (treated as zip)
  const primaryRe = /(js-debug-(server|dap).*\.(?:tar\.gz|tgz|zip|vsix))$/i;
  const fallbackRe = /(js-debug.*\.(?:tar\.gz|tgz|zip|vsix))$/i;

  /** @type {Array<{name: string, url: string, type: 'tgz'|'zip'}>} */
  const serverAssets = [];
  /** @type {Array<{name: string, url: string, type: 'tgz'|'zip'}>} */
  const dapAssets = [];
  /** @type {Array<{name: string, url: string, type: 'tgz'|'zip'}>} */
  const genericAssets = [];

  for (const a of list) {
    const name = String(a?.name || '');
    const url = String(a?.browser_download_url || a?.download_url || a?.url || '');
    const type = getArchiveType(name);
    if (!name || !url || !type) continue;

    const primaryMatch = name.match(primaryRe);
    if (primaryMatch) {
      const role = (primaryMatch[2] || '').toLowerCase();
      if (role === 'server') {
        serverAssets.push({ name, url, type });
      } else if (role === 'dap') {
        dapAssets.push({ name, url, type });
      }
      continue;
    }

    if (fallbackRe.test(name)) {
      genericAssets.push({ name, url, type });
    }
  }

  // Helper to rank by archive type: prefer tgz over zip (vsix counts as zip)
  const rankByType = (arr) =>
    arr.slice().sort((a, b) => (a.type === 'tgz' ? 0 : 1) - (b.type === 'tgz' ? 0 : 1));

  // Selection precedence:
  //  1) server assets (compiled server bundles)
  //  2) dap archives (contain js-debug/src/dapDebugServer.js we can normalize)
  //  3) generic js-debug assets (e.g., .vsix)
  let pick = null;
  if (serverAssets.length) {
    pick = rankByType(serverAssets)[0];
  } else if (dapAssets.length) {
    pick = rankByType(dapAssets)[0];
  } else if (genericAssets.length) {
    pick = rankByType(genericAssets)[0];
  }

  if (!pick) {
    const names = list.map(a => a?.name).filter(Boolean);
    throw new Error(
      `No matching js-debug asset found. Available assets: ${names.length ? names.join(', ') : '(none)'}`
    );
  }

  return pick;
}

/**
 * The asset a pinned vendoring can download without asking the GitHub API.
 *
 * `vendor-manifest.json` pins the release tag AND names the asset it expects,
 * so for the pinned version the download URL is already known:
 * `<upstream>/releases/download/<tag>/<asset>`. That URL is served by
 * github.com (a redirect to the release CDN), not by api.github.com, so it
 * is outside the unauthenticated REST quota of 60 requests per hour per IP —
 * the one a shared CI runner or a Docker build has already used up when the
 * `releases/tags/<tag>` lookup answers 403 (issues #867, #813). The API is
 * only needed to resolve `latest` or a version override away from the pin.
 *
 * @param {{ version?: string, upstream?: string, assets?: Record<string, string> }} pin
 *   The `js-debug` entry of vendor-manifest.json
 * @param {string} version The requested version (`JS_DEBUG_VERSION` or the pin)
 * @returns {{ url: string, name: string, type: 'tgz' | 'zip' } | null}
 *   The asset to download directly, or null when the API has to resolve it
 */
export function pinnedAssetCandidate(pin, version) {
  const tag = pin?.version;
  const upstream = String(pin?.upstream || '').replace(/\/+$/, '');
  const names = Object.keys(pin?.assets || {});
  if (!tag || !upstream || version !== tag || names.length === 0) {
    return null;
  }
  const assets = names.map(name => ({
    name,
    browser_download_url: `${upstream}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`
  }));
  try {
    return selectBestAsset(assets);
  } catch {
    // None of the pinned names is an archive the vendoring understands —
    // let the API path report what the release actually offers.
    return null;
  }
}
