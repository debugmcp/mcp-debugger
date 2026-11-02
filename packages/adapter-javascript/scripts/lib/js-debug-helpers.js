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

/**
 * Whether the vendored artifact already matches what this run would vendor
 * (issue #1049). The script used to skip whenever vsDebugServer.js and its
 * sidecars existed, so a bumped pin in vendor-manifest.json was invisible on
 * every checkout that had vendored once — until JS_DEBUG_FORCE_REBUILD=true or
 * a clean:vendor — and a Docker image built from such a checkout carried the
 * old engine. The verdict reads vendor/js-debug/manifest.json, which every
 * success path writes, and compares its version with the requested one.
 *
 * A local override (JS_DEBUG_LOCAL_PATH) is kept only while the variable still
 * names the file it was vendored from; otherwise the requested version
 * replaces it. 'latest' keeps whatever is vendored: what latest is cannot be
 * known without the API, and the force flag exists for a refresh.
 *
 * @param {{ source?: string, version?: string, original?: string } | null | undefined} manifest
 *   The vendored manifest beside the artifact, or null when there is none
 * @param {string} requestedVersion `JS_DEBUG_VERSION` or the pin
 * @param {Record<string, string | undefined>} env
 * @returns {{ current: boolean, reason: string }}
 */
export function vendoredArtifactIsCurrent(manifest, requestedVersion, env) {
  if (!manifest || typeof manifest !== 'object') {
    return { current: false, reason: 'no vendored manifest beside the artifact (a partial vendoring)' };
  }
  const vendored = String(manifest.version || '');
  if (manifest.source === 'local') {
    const requested = normalizePath(String(env?.JS_DEBUG_LOCAL_PATH || ''));
    if (requested && requested === normalizePath(String(manifest.original || ''))) {
      return { current: true, reason: `local override ${requested} is still requested` };
    }
    return {
      current: false,
      reason: `vendored a local override (${manifest.original || 'unknown path'}) that JS_DEBUG_LOCAL_PATH no longer names; vendoring ${requestedVersion}`
    };
  }
  if (requestedVersion === 'latest') {
    return { current: true, reason: `'latest' requested; keeping vendored ${vendored || 'artifact'} (JS_DEBUG_FORCE_REBUILD=true refreshes it)` };
  }
  if (vendored === requestedVersion) {
    return { current: true, reason: `vendored ${vendored} matches the requested version` };
  }
  return { current: false, reason: `vendored ${vendored || 'an unknown version'}, requested ${requestedVersion}` };
}

/**
 * The digest the extracted server file must match, or null when nothing binds
 * it (issue #1049). vendor-manifest.json records `derived.<name>`, the sha256
 * of the server file inside the pinned archive; until now it was written but
 * never read. It pins WHICH file findServerEntry picked out of the archive, and
 * it is enforced exactly when the archive digest was, so a
 * JS_DEBUG_ALLOW_UNPINNED experiment on another tag is not failed by a digest
 * that belongs to the pinned one.
 *
 * @param {{ derived?: Record<string, string> }} pin The `js-debug` entry of vendor-manifest.json
 * @param {boolean} archiveWasPinned Whether the archive digest was verified on this run
 * @param {string} name The canonical server file name (`vsDebugServer.js`)
 * @returns {string | null}
 * @throws {Error} when the archive was pinned but the manifest has no derived digest for `name`
 */
export function pinnedDerivedDigest(pin, archiveWasPinned, name) {
  if (!archiveWasPinned) return null;
  const digest = pin?.derived?.[name];
  if (typeof digest === 'string' && /^[0-9a-f]{64}$/i.test(digest)) return digest.toLowerCase();
  throw new Error(
    `vendor-manifest.json pins the archive but has no derived digest for ${name}. ` +
    `Record the sha256 of the extracted server file under derived["${name}"] (the bump note in the manifest says how).`
  );
}
