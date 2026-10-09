/**
 * Version probes for the doctor row, and the warm-cache guarantee for the Windows bypass.
 *
 * - `dart --version` prints its banner on stdout (3.13) or stderr (older SDKs): read both.
 * - `flutter --version --machine` is run through the REAL launcher (`flutter.bat` via cmd.exe on
 *   Windows, `bin/flutter` elsewhere): that is what validates the tool cache and rebuilds a stale
 *   snapshot before the adapter spawns the snapshot directly. On a cold cache the launcher prints
 *   "Building flutter tool…" lines before the JSON, so the last JSON object in stdout is parsed.
 * - Node mangles the quoting of a `.bat` spawned through cmd.exe unless the arguments are passed
 *   verbatim (measured: `'\"C:\src\…\flutter.bat\"' is not recognized`).
 */
import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import path from 'node:path';

export type ProbeSpawn = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

export interface ProbeOptions {
  spawn?: ProbeSpawn;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export interface FlutterVersion {
  frameworkVersion?: string;
  channel?: string;
  dartSdkVersion?: string;
}

interface Captured { code: number | null; stdout: string; stderr: string }

function run(command: string, args: string[], options: SpawnOptions & { timeoutMs?: number }, spawnFn: ProbeSpawn): Promise<Captured | null> {
  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      child = spawnFn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, ...options });
    } catch {
      resolve(null);
      return;
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (value: Captured | null): void => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
    const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } finish(null); }, options.timeoutMs ?? 20000);
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString('utf8'); });
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });
    child.on('error', () => finish(null));
    child.on('close', (code) => finish({ code, stdout, stderr }));
  });
}

const DART_VERSION = /Dart SDK version:\s*(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.\-]+)?)/;

export function parseDartVersion(text: string): string | null {
  const m = DART_VERSION.exec(text);
  return m ? m[1] : null;
}

export async function probeDartVersion(dartExe: string, options: ProbeOptions = {}): Promise<string | null> {
  const r = await run(dartExe, ['--version'], { env: options.env, timeoutMs: options.timeoutMs }, options.spawn ?? nodeSpawn);
  if (!r) return null;
  return parseDartVersion(r.stdout) ?? parseDartVersion(r.stderr);
}

/** The real Flutter launcher invocation for a one-off command (never used for the DAP itself). */
export function flutterLauncherCommand(flutterRoot: string, args: string[], platform: NodeJS.Platform): { command: string; args: string[]; windowsVerbatimArguments: boolean } {
  if (platform === 'win32') {
    const bat = path.win32.join(flutterRoot, 'bin', 'flutter.bat');
    const comspec = process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe';
    return { command: comspec, args: ['/d', '/s', '/c', `"${bat}" ${args.join(' ')}`], windowsVerbatimArguments: true };
  }
  return { command: path.posix.join(flutterRoot, 'bin', 'flutter'), args, windowsVerbatimArguments: false };
}

/** Parse the last `{…}` block of `flutter --version --machine` output (bootstrap lines may precede it). */
export function parseFlutterVersionJson(text: string): FlutterVersion | null {
  const start = text.lastIndexOf('\n{');
  const from = start >= 0 ? start + 1 : text.indexOf('{');
  if (from < 0) return null;
  const end = text.lastIndexOf('}');
  if (end < from) return null;
  try {
    const parsed = JSON.parse(text.slice(from, end + 1)) as Record<string, unknown>;
    const pick = (key: string): string | undefined => (typeof parsed[key] === 'string' ? (parsed[key] as string) : undefined);
    return { frameworkVersion: pick('frameworkVersion'), channel: pick('channel'), dartSdkVersion: pick('dartSdkVersion') };
  } catch {
    return null;
  }
}

export async function probeFlutterVersion(flutterRoot: string, options: ProbeOptions & { platform?: NodeJS.Platform } = {}): Promise<FlutterVersion | null> {
  const platform = options.platform ?? process.platform;
  const cmd = flutterLauncherCommand(flutterRoot, ['--version', '--machine'], platform);
  const env = { ...(options.env ?? process.env), FLUTTER_ROOT: flutterRoot };
  const r = await run(cmd.command, cmd.args, { env, windowsVerbatimArguments: cmd.windowsVerbatimArguments, timeoutMs: options.timeoutMs ?? 120000 }, options.spawn ?? nodeSpawn);
  if (!r || r.code !== 0) return null;
  return parseFlutterVersionJson(r.stdout);
}
