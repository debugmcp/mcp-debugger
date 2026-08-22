/**
 * Unit tests for the doctor command's per-language presentation mapping and
 * the doctor-only extras collector (issue #423). Module loading is injected —
 * no adapter package is really imported and nothing is spawned.
 */
import { describe, it, expect, vi } from 'vitest';
import { presentLanguage, collectDoctorExtras } from '../../../../src/cli/commands/doctor/presenters.js';

describe('presentLanguage', () => {
  it('maps python details to runtime + debugpy backend columns', () => {
    const view = presentLanguage('python', {
      pythonPath: 'C:\\Python313\\python.exe',
      pythonVersion: '3.13.2',
      debugpyVersion: '1.8.14'
    });

    expect(view.runtime).toMatchObject({ label: 'Python', path: 'C:\\Python313\\python.exe', version: '3.13.2' });
    expect(view.backend).toMatchObject({ label: 'debugpy', version: '1.8.14' });
  });

  it('maps ruby details to ruby + rdbg columns', () => {
    const view = presentLanguage('ruby', {
      rubyPath: '/usr/bin/ruby',
      rubyVersion: '3.4.2',
      rdbgPath: '/usr/bin/rdbg',
      rdbgVersion: '1.11.0'
    });

    expect(view.runtime).toMatchObject({ label: 'Ruby', version: '3.4.2' });
    expect(view.backend).toMatchObject({ label: 'rdbg', path: '/usr/bin/rdbg', version: '1.11.0' });
  });

  it('maps go details to go + delve columns', () => {
    const view = presentLanguage('go', {
      goPath: '/usr/local/go/bin/go',
      goVersion: '1.24.1',
      dlvPath: '/home/user/go/bin/dlv',
      dlvVersion: '1.26.3'
    });

    expect(view.runtime).toMatchObject({ label: 'Go', version: '1.24.1' });
    expect(view.backend).toMatchObject({ label: 'Delve', version: '1.26.3' });
  });

  it('maps rust details including the CodeLLDB source attribution', () => {
    const view = presentLanguage('rust', {
      cargoVersion: 'cargo 1.85.0',
      codelldbPath: '/vendor/codelldb',
      codelldbVersion: '1.11.8',
      codelldbSource: 'vendored'
    });

    expect(view.runtime).toMatchObject({ label: 'Rust' });
    expect(view.backend).toMatchObject({ label: 'CodeLLDB', version: '1.11.8', source: 'vendored' });
  });

  it('maps dotnet extras into SDK runtime and netcoredbg backend columns', () => {
    const view = presentLanguage('dotnet', {
      debuggerPath: '/opt/netcoredbg/netcoredbg',
      netcoredbgVersion: '3.1.2-1054',
      dotnetSdkVersion: '8.0.301'
    });

    expect(view.runtime).toMatchObject({ label: '.NET SDK', version: '8.0.301' });
    expect(view.backend).toMatchObject({ label: 'netcoredbg', path: '/opt/netcoredbg/netcoredbg', version: '3.1.2-1054' });
  });

  it('maps java details to java + JDI bridge columns', () => {
    const view = presentLanguage('java', {
      javaPath: '/opt/jdk/bin/java',
      javaVersion: '21.0.6',
      jdiBridgeDir: '/opt/bridge'
    });

    expect(view.runtime).toMatchObject({ label: 'Java', version: '21.0.6' });
    expect(view.backend).toMatchObject({ label: 'JDI bridge', path: '/opt/bridge' });
  });

  it('shows only the cpp compiler banner when a version was captured (the banner names the command)', () => {
    const view = presentLanguage('cpp', {
      compiler: 'g++',
      compilerVersion: 'g++ (MinGW-w64) 13.2.0'
    });

    expect(view.runtime).toMatchObject({ label: 'C/C++ compiler', version: 'g++ (MinGW-w64) 13.2.0' });
    expect(view.runtime?.path).toBeUndefined();
  });

  it('falls back to the bare cpp compiler command when no version banner was captured', () => {
    const view = presentLanguage('cpp', { compiler: 'g++' });

    expect(view.runtime).toMatchObject({ label: 'C/C++ compiler', path: 'g++' });
  });

  it('marks mock as built-in', () => {
    const view = presentLanguage('mock', {});

    expect(view.runtime?.label).toContain('built-in');
    expect(view.backend?.label).toContain('built-in');
  });

  it('returns empty cells when the probe produced no details (failed/timed-out probe)', () => {
    const view = presentLanguage('python', undefined);

    expect(view.runtime).toBeUndefined();
    expect(view.backend).toBeUndefined();
  });

  it('omits a component that was not detected instead of naming it as if found', () => {
    // dotnet with netcoredbg resolved but no SDK: the runtime cell must read
    // as absent, not ".NET SDK".
    const view = presentLanguage('dotnet', { debuggerPath: '/opt/netcoredbg/netcoredbg' });

    expect(view.runtime).toBeUndefined();
    expect(view.backend).toMatchObject({ label: 'netcoredbg', path: '/opt/netcoredbg/netcoredbg' });
  });

  it('keeps the vendored js-debug backend visible without a version (source counts as detection)', () => {
    const view = presentLanguage('javascript', { nodeVersion: 'v22.0.0' });

    expect(view.backend).toMatchObject({ label: 'js-debug', source: 'vendored' });
  });
});

describe('collectDoctorExtras', () => {
  it('collects netcoredbg and SDK versions for dotnet via the adapter package', async () => {
    const importModule = vi.fn().mockResolvedValue({
      getNetcoredbgVersion: vi.fn().mockResolvedValue('3.1.2-1054'),
      getDotnetSdkVersion: vi.fn().mockResolvedValue('8.0.301')
    });

    const extras = await collectDoctorExtras('dotnet', { debuggerPath: '/opt/netcoredbg' }, { importModule });

    expect(importModule).toHaveBeenCalledWith('@debugmcp/adapter-dotnet');
    expect(extras).toEqual({ netcoredbgVersion: '3.1.2-1054', dotnetSdkVersion: '8.0.301' });
  });

  it('skips the netcoredbg version probe when no debugger path was resolved', async () => {
    const getNetcoredbgVersion = vi.fn();
    const importModule = vi.fn().mockResolvedValue({
      getNetcoredbgVersion,
      getDotnetSdkVersion: vi.fn().mockResolvedValue(null)
    });

    const extras = await collectDoctorExtras('dotnet', {}, { importModule });

    expect(getNetcoredbgVersion).not.toHaveBeenCalled();
    expect(extras).toEqual({});
  });

  it('collects the javac path for java', async () => {
    const findJavacExecutable = vi.fn().mockResolvedValue('/opt/jdk/bin/javac');
    const importModule = vi.fn().mockResolvedValue({ findJavacExecutable });

    const extras = await collectDoctorExtras('java', { javaPath: '/opt/jdk/bin/java' }, { importModule });

    expect(importModule).toHaveBeenCalledWith('@debugmcp/adapter-java');
    expect(findJavacExecutable).toHaveBeenCalledWith('/opt/jdk/bin/java');
    expect(extras).toEqual({ javacPath: '/opt/jdk/bin/javac' });
  });

  it('collects the compiler version banner for cpp, reusing the already-discovered command', async () => {
    const getCompilerInfo = vi.fn().mockResolvedValue({ command: 'g++', version: 'g++ (MinGW-w64) 13.2.0' });
    const importModule = vi.fn().mockResolvedValue({ getCompilerInfo });

    const extras = await collectDoctorExtras('cpp', { compiler: 'g++' }, { importModule });

    // validate() already discovered the command — extras must not re-probe the
    // whole candidate list.
    expect(getCompilerInfo).toHaveBeenCalledWith('g++');
    expect(extras).toEqual({ compilerVersion: 'g++ (MinGW-w64) 13.2.0' });
  });

  it('returns no extras for languages without doctor-only probes', async () => {
    const importModule = vi.fn();

    const extras = await collectDoctorExtras('python', { pythonPath: '/usr/bin/python3' }, { importModule });

    expect(importModule).not.toHaveBeenCalled();
    expect(extras).toEqual({});
  });

  it('returns no extras when the adapter package cannot be imported', async () => {
    const importModule = vi.fn().mockRejectedValue(new Error('MODULE_NOT_FOUND'));

    const extras = await collectDoctorExtras('dotnet', { debuggerPath: '/x' }, { importModule });

    expect(extras).toEqual({});
  });
});
