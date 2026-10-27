/**
 * `flutter devices --machine` and `flutter emulators` behind the doctor's targets row (issue #877):
 * measured shapes from Flutter 3.47.7 (0.9 s and 0.7 s on the box).
 */
import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { parseFlutterDevicesJson, parseFlutterEmulators, probeFlutterDevices, probeFlutterEmulators, type ProbeSpawn } from '../../src/utils/version-probes.js';

const DEVICES = '[\n  {\n    "name": "sdk gphone64 x86 64",\n    "id": "emulator-5554",\n    "isSupported": true,\n    "targetPlatform": "android-x64",\n    "emulator": true,\n    "sdk": "Android 15 (API 35)",\n    "capabilities": { "hotReload": true, "hotRestart": true }\n  },\n  {\n    "name": "Windows",\n    "id": "windows",\n    "isSupported": true,\n    "targetPlatform": "windows-x64",\n    "emulator": false,\n    "sdk": "Microsoft Windows [Version 10.0.26200.9711]"\n  },\n  {\n    "name": "Chrome",\n    "id": "chrome",\n    "isSupported": true,\n    "targetPlatform": "web-javascript",\n    "emulator": false,\n    "sdk": "Google Chrome 155.0.8059.85"\n  }\n]\n';
const EMULATORS = "1 available emulator:\n\nId        • Name      • Manufacturer • Platform\n\nmcp_api35 • mcp api35 • Google       • android\n\nTo run an emulator, run 'flutter emulators --launch <emulator id>'.\n";

function fakeSpawn(stdout: string, code = 0) {
  const calls: Array<{ command: string; args: string[] }> = [];
  const spawn: ProbeSpawn = (command, args) => {
    calls.push({ command, args: [...args] });
    const child = new EventEmitter() as ChildProcess & EventEmitter;
    (child as { stdout: EventEmitter }).stdout = new EventEmitter();
    (child as { stderr: EventEmitter }).stderr = new EventEmitter();
    (child as { kill: () => boolean }).kill = () => true;
    setImmediate(() => { child.stdout!.emit('data', Buffer.from(stdout)); child.emit('close', code, null); });
    return child;
  };
  return { spawn, calls };
}

describe('flutter devices / emulators probes (issue #877)', () => {
  it('parses the devices array, skipping any text before it', () => {
    expect(parseFlutterDevicesJson('Building flutter tool...\n' + DEVICES)).toEqual([
      { id: 'emulator-5554', name: 'sdk gphone64 x86 64', targetPlatform: 'android-x64', emulator: true, sdk: 'Android 15 (API 35)' },
      { id: 'windows', name: 'Windows', targetPlatform: 'windows-x64', emulator: false, sdk: 'Microsoft Windows [Version 10.0.26200.9711]' },
      { id: 'chrome', name: 'Chrome', targetPlatform: 'web-javascript', emulator: false, sdk: 'Google Chrome 155.0.8059.85' },
    ]);
    expect(parseFlutterDevicesJson('No devices')).toBeNull();
  });

  it('parses the emulator ids out of the text table', () => {
    expect(parseFlutterEmulators(EMULATORS)).toEqual(['mcp_api35']);
    expect(parseFlutterEmulators('No emulators available.\n')).toEqual([]);
  });

  it('runs the real launcher for both probes and answers null on a failed exit', async () => {
    const devices = fakeSpawn(DEVICES);
    expect((await probeFlutterDevices('C:\\src\\flutter', { platform: 'win32', spawn: devices.spawn }))?.map((d) => d.id)).toEqual(['emulator-5554', 'windows', 'chrome']);
    expect(devices.calls[0].args.join(' ')).toMatch(/flutter\.bat" devices --machine/);
    const emulators = fakeSpawn(EMULATORS);
    expect(await probeFlutterEmulators('/opt/flutter', { platform: 'linux', spawn: emulators.spawn })).toEqual(['mcp_api35']);
    expect(emulators.calls[0]).toEqual({ command: '/opt/flutter/bin/flutter', args: ['emulators'] });
    expect(await probeFlutterDevices('/opt/flutter', { platform: 'linux', spawn: fakeSpawn('boom', 1).spawn })).toBeNull();
  });

  it('kills the whole process tree of a probe that outlives its timeout on Windows (review of #1018)', async () => {
    const spawned: Array<{ command: string; args: string[] }> = [];
    const spawn: ProbeSpawn = (command, args) => {
      spawned.push({ command, args });
      const child = new EventEmitter() as ChildProcess;
      Object.assign(child, { pid: 4242, stdout: new EventEmitter(), stderr: new EventEmitter(), kill: () => true });
      if (command === 'taskkill') setImmediate(() => child.emit('close', 0, null));
      return child; // the flutter command never closes
    };

    expect(await probeFlutterDevices('C:\\src\\flutter', { platform: 'win32', spawn, timeoutMs: 20 })).toBeNull();
    expect(spawned[0].command).toMatch(/cmd\.exe$/i);
    expect(spawned[1]).toEqual({ command: 'taskkill', args: ['/PID', '4242', '/T', '/F'] });
  });
});
