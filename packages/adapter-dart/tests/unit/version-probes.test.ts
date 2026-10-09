/**
 * Version probes for the doctor row and the warm-cache guarantee.
 *
 * Measured in the #790 spike: `dart --version` prints to stdout on 3.13 (older SDKs used
 * stderr); `flutter --version --machine` prints bootstrap lines ("Building flutter tool…",
 * "Running pub upgrade…") BEFORE its JSON on a cold cache, and running it through the real
 * launcher is what rebuilds a stale tool snapshot. Node mangles the quoting of a `.bat` spawned
 * through cmd.exe unless the arguments are passed verbatim.
 */
import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { flutterLauncherCommand, parseDartVersion, parseFlutterVersionJson, probeDartVersion, probeFlutterVersion, type ProbeSpawn } from '../../src/utils/version-probes.js';

function fakeSpawn(script: { stdout?: string; stderr?: string; code?: number; error?: Error }) {
  const calls: { command: string; args: string[]; options: Record<string, unknown> }[] = [];
  const spawn: ProbeSpawn = (command, args, options) => {
    calls.push({ command, args, options: options as Record<string, unknown> });
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill: vi.fn() });
    setTimeout(() => {
      if (script.error) { child.emit('error', script.error); return; }
      if (script.stdout) child.stdout.emit('data', Buffer.from(script.stdout));
      if (script.stderr) child.stderr.emit('data', Buffer.from(script.stderr));
      child.emit('close', script.code ?? 0, null);
    }, 1);
    return child as unknown as ChildProcess;
  };
  return { spawn, calls };
}

describe('parseDartVersion', () => {
  it('extracts the semantic version from the banner', () => {
    expect(parseDartVersion('Dart SDK version: 3.13.4 (stable) (Tue Sep 15 01:01:15 2026 -0700) on "windows_x64"\n')).toBe('3.13.4');
    expect(parseDartVersion('Dart SDK version: 3.14.0-211.1.beta (beta) (…)')).toBe('3.14.0-211.1.beta');
    expect(parseDartVersion('nothing here')).toBeNull();
  });
});

describe('probeDartVersion', () => {
  it('reads the version from stdout', async () => {
    const { spawn, calls } = fakeSpawn({ stdout: 'Dart SDK version: 3.13.4 (stable) (…) on "windows_x64"\n' });
    await expect(probeDartVersion('C:\\dart\\bin\\dart.exe', { spawn })).resolves.toBe('3.13.4');
    expect(calls[0]).toMatchObject({ command: 'C:\\dart\\bin\\dart.exe', args: ['--version'] });
  });

  it('reads the version from stderr (older SDKs)', async () => {
    const { spawn } = fakeSpawn({ stderr: 'Dart SDK version: 2.19.6 (stable) (…) on "linux_x64"\n' });
    await expect(probeDartVersion('/usr/lib/dart/bin/dart', { spawn })).resolves.toBe('2.19.6');
  });

  it('resolves null when the executable cannot be spawned', async () => {
    const { spawn } = fakeSpawn({ error: Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }) });
    await expect(probeDartVersion('C:\\missing\\dart.exe', { spawn })).resolves.toBeNull();
  });
});

describe('flutterLauncherCommand', () => {
  it('runs flutter.bat through cmd.exe with verbatim arguments on Windows', () => {
    const c = flutterLauncherCommand('C:\\src\\flutter', ['--version', '--machine'], 'win32');
    expect(c.command.toLowerCase()).toMatch(/cmd\.exe$/);
    expect(c.args).toEqual(['/d', '/s', '/c', '"C:\\src\\flutter\\bin\\flutter.bat" --version --machine']);
    expect(c.windowsVerbatimArguments).toBe(true);
  });

  it('runs bin/flutter directly elsewhere', () => {
    const c = flutterLauncherCommand('/opt/flutter', ['--version', '--machine'], 'linux');
    expect(c).toMatchObject({ command: '/opt/flutter/bin/flutter', args: ['--version', '--machine'] });
  });
});

describe('parseFlutterVersionJson', () => {
  it('takes the last JSON object even when bootstrap lines precede it', () => {
    const text = 'Building flutter tool...\nRunning pub upgrade...\nGot dependencies.\n{\n  "frameworkVersion": "3.47.7",\n  "channel": "stable",\n  "dartSdkVersion": "3.13.5",\n  "flutterRoot": "C:\\\\src\\\\flutter"\n}\n';
    expect(parseFlutterVersionJson(text)).toEqual({ frameworkVersion: '3.47.7', channel: 'stable', dartSdkVersion: '3.13.5' });
  });

  it('returns null without a JSON object', () => {
    expect(parseFlutterVersionJson('Waiting for another flutter command to release the startup lock...\n')).toBeNull();
  });
});

describe('probeFlutterVersion', () => {
  it('runs the real launcher and returns the parsed versions', async () => {
    const { spawn, calls } = fakeSpawn({ stdout: '{"frameworkVersion":"3.47.7","channel":"stable","dartSdkVersion":"3.13.5"}\n' });
    const v = await probeFlutterVersion('C:\\src\\flutter', { spawn, platform: 'win32' });
    expect(v).toEqual({ frameworkVersion: '3.47.7', channel: 'stable', dartSdkVersion: '3.13.5' });
    expect(calls[0].args.at(-1)).toContain('--version --machine');
    expect(calls[0].options).toMatchObject({ windowsVerbatimArguments: true, env: expect.objectContaining({ FLUTTER_ROOT: 'C:\\src\\flutter' }) });
  });

  it('resolves null on a non-zero exit', async () => {
    const { spawn } = fakeSpawn({ stderr: 'Error: Unable to find git in your PATH.\n', code: 1 });
    await expect(probeFlutterVersion('C:\\src\\flutter', { spawn, platform: 'win32' })).resolves.toBeNull();
  });
});
