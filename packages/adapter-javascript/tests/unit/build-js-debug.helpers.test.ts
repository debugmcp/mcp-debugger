import { describe, it, expect } from 'vitest';

// Import ESM helper from JS file
import { selectBestAsset, normalizePath, pinnedAssetCandidate, vendoredArtifactIsCurrent, pinnedDerivedDigest } from '../../scripts/lib/js-debug-helpers';

describe('js-debug helpers: normalizePath', () => {
  it('normalizes backslashes to forward slashes', () => {
    expect(normalizePath('C:\\\\temp\\\\file.txt')).toBe('C:/temp/file.txt');
    expect(normalizePath('/tmp/file.txt')).toBe('/tmp/file.txt');
    expect(normalizePath('')).toBe('');
    // cast to any to exercise runtime null-handling — normalizePath returns '' for non-string input
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizePath(null as any)).toBe('');
  });
});

describe('js-debug helpers: selectBestAsset', () => {
  it('prefers tgz over zip when both match dap/server', () => {
    const assets = [
      { name: 'js-debug-dap.zip', browser_download_url: 'https://example.com/a.zip' },
      { name: 'js-debug-dap.tgz', browser_download_url: 'https://example.com/a.tgz' }
    ];
    const sel = selectBestAsset(assets);
    expect(sel.name).toBe('js-debug-dap.tgz');
    expect(sel.type).toBe('tgz');
    expect(sel.url).toBe('https://example.com/a.tgz');
  });

  it('prefers server over dap when both present (regardless of archive type)', () => {
    const assets = [
      { name: 'js-debug-dap.tgz', browser_download_url: 'https://example.com/dap.tgz' },
      { name: 'js-debug-server.zip', browser_download_url: 'https://example.com/server.zip' }
    ];
    const sel = selectBestAsset(assets);
    expect(sel.name).toBe('js-debug-server.zip');
    expect(sel.type).toBe('zip');
    expect(sel.url).toBe('https://example.com/server.zip');
  });

  it('selects zip when only zip is available', () => {
    const assets = [{ name: 'js-debug-server.zip', browser_download_url: 'https://example.com/s.zip' }];
    const sel = selectBestAsset(assets);
    expect(sel.name).toBe('js-debug-server.zip');
    expect(sel.type).toBe('zip');
    expect(sel.url).toBe('https://example.com/s.zip');
  });

  it('is case-insensitive and handles .tar.gz', () => {
    const assets = [
      { name: 'JS-DEBUG-SERVER.TAR.GZ', browser_download_url: 'https://example.com/s.tar.gz' }
    ];
    const sel = selectBestAsset(assets);
    expect(sel.name).toBe('JS-DEBUG-SERVER.TAR.GZ');
    expect(sel.type).toBe('tgz');
    expect(sel.url).toBe('https://example.com/s.tar.gz');
  });

  it('falls back to generic js-debug.* when dap/server not present', () => {
    const assets = [
      { name: 'js-debug-tools.zip', browser_download_url: 'https://example.com/tools.zip' },
      { name: 'misc.zip', browser_download_url: 'https://example.com/misc.zip' }
    ];
    const sel = selectBestAsset(assets);
    expect(sel.name).toBe('js-debug-tools.zip');
    expect(sel.type).toBe('zip');
    expect(sel.url).toBe('https://example.com/tools.zip');
  });

  it('still prefers dap/server over generic when both present', () => {
    const assets = [
      { name: 'js-debug-tools.zip', browser_download_url: 'https://example.com/tools.zip' },
      { name: 'js-debug-dap.zip', browser_download_url: 'https://example.com/dap.zip' }
    ];
    const sel = selectBestAsset(assets);
    expect(sel.name).toBe('js-debug-dap.zip');
    expect(sel.type).toBe('zip');
    expect(sel.url).toBe('https://example.com/dap.zip');
  });

  it('throws with a helpful message when no assets match', () => {
    const assets = [
      { name: 'release-notes.txt', browser_download_url: 'https://example.com/rn.txt' },
      { name: 'something-else.tar', browser_download_url: 'https://example.com/se.tar' }
    ];
    expect(() => selectBestAsset(assets)).toThrow(/No matching js-debug asset found/i);
  });
});

describe('js-debug helpers: pinnedAssetCandidate (issues #867, #813)', () => {
  const pin = {
    version: 'v1.112.0',
    upstream: 'https://github.com/microsoft/vscode-js-debug',
    assets: {
      'js-debug-dap-v1.112.0.tar.gz': '31eb1bd9792f62c32f7c22b66ce612e2e54a7664201a2d80bdb49cc4bf4ca925'
    }
  };

  it('builds a releases/download URL for the pinned asset so no GitHub API call is needed', () => {
    const candidate = pinnedAssetCandidate(pin, 'v1.112.0');
    expect(candidate).toEqual({
      name: 'js-debug-dap-v1.112.0.tar.gz',
      url: 'https://github.com/microsoft/vscode-js-debug/releases/download/v1.112.0/js-debug-dap-v1.112.0.tar.gz',
      type: 'tgz'
    });
  });

  it('returns null for "latest" — the release must be resolved through the API', () => {
    expect(pinnedAssetCandidate(pin, 'latest')).toBeNull();
  });

  it('returns null for a version override away from the pin', () => {
    expect(pinnedAssetCandidate(pin, 'v1.111.0')).toBeNull();
  });

  it('returns null when the pin names no assets', () => {
    expect(pinnedAssetCandidate({ ...pin, assets: {} }, 'v1.112.0')).toBeNull();
    expect(pinnedAssetCandidate({ version: 'v1.112.0', upstream: pin.upstream }, 'v1.112.0')).toBeNull();
  });

  it('applies the selectBestAsset preference when the pin names several assets', () => {
    const several = {
      ...pin,
      assets: {
        'js-debug-dap-v1.112.0.zip': 'a',
        'js-debug-dap-v1.112.0.tar.gz': 'b'
      }
    };
    expect(pinnedAssetCandidate(several, 'v1.112.0')?.name).toBe('js-debug-dap-v1.112.0.tar.gz');
  });

  it('derives the download host from the pin upstream, with a trailing slash tolerated', () => {
    const forked = { ...pin, upstream: 'https://github.com/example/js-debug-fork/' };
    expect(pinnedAssetCandidate(forked, 'v1.112.0')?.url).toBe(
      'https://github.com/example/js-debug-fork/releases/download/v1.112.0/js-debug-dap-v1.112.0.tar.gz'
    );
  });
});

describe('js-debug helpers: vendoredArtifactIsCurrent (issue #1049)', () => {
  // The vendor script used to skip whenever vsDebugServer.js and its sidecars existed, so a
  // bumped pin was invisible on every checkout that had vendored once. The verdict reads
  // the manifest the script writes beside the artifact.
  const pin = 'v1.140.0';

  it('is not current without a vendored manifest (every success path writes one)', () => {
    const verdict = vendoredArtifactIsCurrent(null, pin, {});
    expect(verdict.current).toBe(false);
    expect(verdict.reason).toContain('no vendored manifest');
  });

  it('is current when the vendored version is the requested one', () => {
    expect(vendoredArtifactIsCurrent({ source: 'prebuilt', version: 'v1.140.0' }, pin, {}).current).toBe(true);
  });

  it('is not current when the pin moved past the vendored version, and says both', () => {
    const verdict = vendoredArtifactIsCurrent({ source: 'prebuilt', version: 'v1.112.0' }, pin, {});
    expect(verdict.current).toBe(false);
    expect(verdict.reason).toContain('v1.112.0');
    expect(verdict.reason).toContain('v1.140.0');
  });

  it('keeps whatever is vendored when "latest" is requested (unknowable without the API)', () => {
    expect(vendoredArtifactIsCurrent({ source: 'prebuilt', version: 'v1.112.0' }, 'latest', {}).current).toBe(true);
  });

  it('keeps a local override only while JS_DEBUG_LOCAL_PATH still names it', () => {
    const local = { source: 'local', version: 'local-override', original: 'C:/dev/js-debug/dist/vsDebugServer.js' };
    // Windows spelling of the same file; String.raw keeps the backslashes out of JS escapes.
    expect(vendoredArtifactIsCurrent(local, pin, { JS_DEBUG_LOCAL_PATH: String.raw`C:\dev\js-debug\dist\vsDebugServer.js` }).current).toBe(true);
    expect(vendoredArtifactIsCurrent(local, pin, { JS_DEBUG_LOCAL_PATH: String.raw`C:\other\vsDebugServer.js` }).current).toBe(false);
    expect(vendoredArtifactIsCurrent(local, pin, {}).current).toBe(false);
  });
});

describe('js-debug helpers: pinnedDerivedDigest (issue #1049)', () => {
  // vendor-manifest.json records the digest of the extracted server file; until now nothing
  // read it. It binds the archive digest to WHICH file findServerEntry picked.
  const pin = {
    version: 'v1.140.0',
    upstream: 'https://github.com/microsoft/vscode-js-debug',
    assets: { 'js-debug-dap-v1.140.0.tar.gz': 'a'.repeat(64) },
    derived: { 'vsDebugServer.js': 'b'.repeat(64) }
  };

  it('names the digest the extracted server file must match when the archive was pinned', () => {
    expect(pinnedDerivedDigest(pin, true, 'vsDebugServer.js')).toBe('b'.repeat(64));
  });

  it('returns null when the archive itself was unpinned (an allowed experiment on another tag)', () => {
    expect(pinnedDerivedDigest(pin, false, 'vsDebugServer.js')).toBeNull();
  });

  it('refuses a pinned archive whose manifest forgot the derived digest', () => {
    expect(() => pinnedDerivedDigest({ ...pin, derived: {} }, true, 'vsDebugServer.js')).toThrow(/derived/);
    expect(() => pinnedDerivedDigest({ version: pin.version, upstream: pin.upstream, assets: pin.assets }, true, 'vsDebugServer.js')).toThrow(/derived/);
  });
});
