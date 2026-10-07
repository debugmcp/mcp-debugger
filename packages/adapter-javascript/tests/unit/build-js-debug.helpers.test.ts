import { describe, it, expect } from 'vitest';

// Import ESM helper from JS file
import { selectBestAsset, normalizePath, pinnedAssetCandidate } from '../../scripts/lib/js-debug-helpers';

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
