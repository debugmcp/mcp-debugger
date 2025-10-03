import { describe, it, expect } from 'vitest';

// Import ESM helper from JS file
import { selectBestAsset, normalizePath } from '../../scripts/lib/js-debug-helpers';

describe('js-debug helpers: normalizePath', () => {
  it('normalizes backslashes to forward slashes', () => {
    expect(normalizePath('C:\\\\temp\\\\file.txt')).toBe('C:/temp/file.txt');
    expect(normalizePath('/tmp/file.txt')).toBe('/tmp/file.txt');
    expect(normalizePath('')).toBe('');
    // @ts-expect-no-error runtime accepts any but returns empty string for non-string
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
