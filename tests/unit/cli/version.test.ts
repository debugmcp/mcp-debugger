import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { getVersion } from '../../../src/cli/version.js';

vi.mock('fs');

describe('Version Utility', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.resetAllMocks();
    delete (globalThis as { __MCP_DEBUGGER_VERSION__?: string }).__MCP_DEBUGGER_VERSION__;
  });

  // The Docker bundle runs from /app/dist with no package.json beside it, so esbuild bakes
  // the version in as a global at bundle time (scripts/bundle.js); the banner, --version and
  // serverInfo read that first (issue #1054). Unbundled, the identifier is undefined and the
  // package.json walk below is the answer.
  it('returns the version baked into the bundle without reading any package.json', () => {
    (globalThis as { __MCP_DEBUGGER_VERSION__?: string }).__MCP_DEBUGGER_VERSION__ = '9.9.9';

    expect(getVersion()).toBe('9.9.9');
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it('ignores an empty baked version and falls through to package.json', () => {
    (globalThis as { __MCP_DEBUGGER_VERSION__?: string }).__MCP_DEBUGGER_VERSION__ = '   ';
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ version: '1.2.3' }));

    expect(getVersion()).toBe('1.2.3');
  });

  it('should return version from package.json', () => {
    const mockPackageJson = {
      name: 'test-package',
      version: '1.2.3'
    };

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockPackageJson));

    const version = getVersion();

    expect(version).toBe('1.2.3');
    expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('package.json'), 'utf8');
  });

  it('should return 0.0.0 if version is not present in package.json', () => {
    const mockPackageJson = {
      name: 'test-package'
      // No version field
    };

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockPackageJson));

    const version = getVersion();

    expect(version).toBe('0.0.0');
  });

  it('should return 0.0.0 and log error if reading package.json fails', () => {
    const error = new Error('File not found');
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw error;
    });

    const version = getVersion();

    expect(version).toBe('0.0.0');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to read version from package.json:', error);
  });

  it('should return 0.0.0 and log error if package.json has invalid JSON', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }');

    const version = getVersion();

    expect(version).toBe('0.0.0');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to read version from package.json:', expect.any(Error));
  });

  it('should handle empty package.json', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{}');

    const version = getVersion();

    expect(version).toBe('0.0.0');
  });

  it('suppresses error logging when console output is silenced', () => {
    vi.stubEnv('CONSOLE_OUTPUT_SILENCED', '1');
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('boom');
    });

    getVersion();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
