/**
 * executablePath at session creation (issue #693).
 *
 * `createSession` forwards `executablePath` to the store, which resolves the
 * per-language default through the adapter policy. The rename from `pythonPath`
 * left this wiring with a single assertion; these pin it per language.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { DebugLanguage } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';

/**
 * Per-language default when no path is given. Python (platform- and
 * env-dependent) and cpp/rust/cobol (deliberately undefined) are covered by their
 * own tests below; the completeness guard accounts for those four.
 */
const DEFAULTS: ReadonlyArray<readonly [DebugLanguage, string]> = [
  [DebugLanguage.JAVASCRIPT, 'node'],
  [DebugLanguage.GO, 'dlv'],
  [DebugLanguage.RUBY, 'ruby'],
  [DebugLanguage.JAVA, 'java'],
  [DebugLanguage.DOTNET, 'netcoredbg'],
  [DebugLanguage.MOCK, 'mock']
];

describe('SessionManager.createSession executablePath (issue #693)', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    vi.stubEnv('PYTHON_PATH', undefined);
    vi.stubEnv('DLV_PATH', undefined);
    vi.stubEnv('NETCOREDBG_PATH', undefined);
    vi.stubEnv('RUBY_PATH', undefined);
    vi.stubEnv('RUBY_EXECUTABLE', undefined);
    vi.stubEnv('JAVA_HOME', undefined);
    sessionManager = new SessionManager({ logDirBase: '/tmp/test-sessions' }, createMockDependencies());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function executablePathFor(language: DebugLanguage, executablePath?: string): Promise<string | undefined> {
    const info = await sessionManager.createSession({ language, executablePath });
    const session = sessionManager.getSession(info.id);
    // No `?.` here: the cpp/rust `toBeUndefined()` must not pass on a missing session.
    if (!session) {
      throw new Error(`session ${info.id} (${language}) was not stored`);
    }
    return session.executablePath;
  }

  it('every DebugLanguage has a default row (or is python / cpp / rust / cobol, covered below)', () => {
    expect(DEFAULTS.length + 1 + 3).toBe(Object.values(DebugLanguage).length);
  });

  it.each(Object.values(DebugLanguage))('%s stores an explicit path verbatim', async (language) => {
    expect(await executablePathFor(language, '/opt/custom/bin/runtime')).toBe('/opt/custom/bin/runtime');
  });

  it.each(DEFAULTS)('%s defaults to %s when no path is given', async (language, expected) => {
    expect(await executablePathFor(language)).toBe(expected);
  });

  it('python defaults by platform when PYTHON_PATH is unset', async () => {
    expect(await executablePathFor(DebugLanguage.PYTHON)).toBe(process.platform === 'win32' ? 'python' : 'python3');
  });

  it('python honours PYTHON_PATH at creation time', async () => {
    vi.stubEnv('PYTHON_PATH', '/venv/bin/python');
    expect(await executablePathFor(DebugLanguage.PYTHON)).toBe('/venv/bin/python');
  });

  it('an explicit path beats PYTHON_PATH', async () => {
    vi.stubEnv('PYTHON_PATH', '/venv/bin/python');
    expect(await executablePathFor(DebugLanguage.PYTHON, '/usr/bin/python3.12')).toBe('/usr/bin/python3.12');
  });

  it.each([DebugLanguage.CPP, DebugLanguage.RUST, DebugLanguage.COBOL])('%s leaves the path undefined for the adapter to resolve', async (language) => {
    expect(await executablePathFor(language)).toBeUndefined();
  });
});
