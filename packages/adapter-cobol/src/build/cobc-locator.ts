/**
 * Locate the GnuCOBOL compiler (`cobc`) and the environment it needs when
 * spawned outside its own shell.
 *
 * Measured facts this encodes (issue #759 spike, GnuCOBOL 3.2 on MSYS2):
 * - MSYS2's `cobc` defaults `COB_CONFIG_DIR` to the MSYS-rooted
 *   `/mingw64/share/gnucobol/config`, which only resolves inside an MSYS2
 *   shell. From Node/PowerShell every compile fails with "configuration
 *   error: …\default.conf: No such file or directory" unless the directory is
 *   passed explicitly. The copybook dir has the same shape.
 * - The compiler shells out to `gcc`, and the debuggee needs `libcob-4.dll`,
 *   so `<prefix>/bin` must be on PATH for both the compile and the launch.
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';

/**
 * GnuCOBOL's module loader, which every install ships beside cobc (apt `gnucobol3`,
 * MSYS2, Homebrew): `cobcrun <PROGRAM-ID> [args…]` loads `<PROGRAM-ID>.<so|dll|dylib>`
 * from COB_LIBRARY_PATH and runs it.
 */
export function cobcrunPath(cobc: CobcLocation, platform: NodeJS.Platform = process.platform): string {
  return path.join(cobc.binDir, platform === 'win32' ? 'cobcrun.exe' : 'cobcrun');
}

export interface CobcLocation {
  /** Absolute path of the cobc executable. */
  path: string;
  /** Directory holding cobc (also gcc and libcob on MSYS2/Homebrew). */
  binDir: string;
  /** Install prefix (`binDir/..`). */
  prefix: string;
  /** First line of `cobc --version`, e.g. `cobc (GnuCOBOL) 3.2.0`, when it ran. */
  versionLine: string | null;
  /** `3.2.0` extracted from the banner, when parseable. */
  version: string | null;
  /** `<prefix>/share/gnucobol/config` when it exists (MSYS2/Homebrew layouts). */
  configDir?: string;
  /** `<prefix>/share/gnucobol/copy` when it exists. */
  copyDir?: string;
}

export interface CobcLocatorOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  /** Injectable probe: resolve to the first stdout line of `<cmd> --version`, or null when it does not run. */
  probeVersion?: (command: string) => Promise<string | null>;
  exists?: (p: string) => boolean;
}

const PROBE_KILL_TIMEOUT_MS = 10_000;

export const COBC_ENV_PATH_VAR = 'COBC_PATH';

/** Well-known install locations, tried after `COBC_PATH` and PATH. */
export function cobcCandidatePaths(platform: NodeJS.Platform): string[] {
  if (platform === 'win32') {
    return [
      'C:\\msys64\\mingw64\\bin\\cobc.exe',
      'C:\\msys64\\ucrt64\\bin\\cobc.exe',
      'C:\\msys64\\clang64\\bin\\cobc.exe',
      'C:\\GnuCOBOL\\bin\\cobc.exe'
    ];
  }
  if (platform === 'darwin') {
    return ['/opt/homebrew/bin/cobc', '/usr/local/bin/cobc', '/usr/bin/cobc'];
  }
  return ['/usr/bin/cobc', '/usr/local/bin/cobc'];
}

/** Default `--version` probe: first stdout line, null on spawn failure / non-zero exit. */
export function probeCobcVersion(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let output = '';
      let settled = false;
      const finish = (value: string | null): void => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }
      };
      const timer = setTimeout(() => {
        try { child.kill(); } catch { /* already gone */ }
        finish(null);
      }, PROBE_KILL_TIMEOUT_MS);
      child.stdout?.on('data', (data: Buffer) => { output += data.toString(); });
      child.on('error', () => finish(null));
      // 'close' rather than 'exit' so the stdout pipe has drained (issue #423 lesson).
      child.on('close', (code) => {
        const first = output.split(/\r?\n/).find((line) => line.trim().length > 0) ?? null;
        finish(code === 0 ? first : null);
      });
    } catch {
      resolve(null);
    }
  });
}

export function parseCobcVersion(banner: string | null): string | null {
  if (!banner) {
    return null;
  }
  // Anchored per whitespace token so a run of digits cannot make the scan quadratic:
  // `cobc (GnuCOBOL) 3.2.0` -> 3.2.0, `cobc (GnuCOBOL) 3.1.2.0` -> 3.1.2.
  for (const token of banner.split(/\s+/)) {
    const match = /^(\d+\.\d+(?:\.\d+)?)/.exec(token);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function describeLocation(
  resolvedPath: string,
  banner: string | null,
  exists: (p: string) => boolean
): CobcLocation {
  const binDir = path.dirname(resolvedPath);
  const prefix = path.dirname(binDir);
  const configDir = path.join(prefix, 'share', 'gnucobol', 'config');
  const copyDir = path.join(prefix, 'share', 'gnucobol', 'copy');
  return {
    path: resolvedPath,
    binDir,
    prefix,
    versionLine: banner,
    version: parseCobcVersion(banner),
    ...(exists(configDir) ? { configDir } : {}),
    ...(exists(copyDir) ? { copyDir } : {})
  };
}

function searchPath(command: string, env: NodeJS.ProcessEnv, platform: NodeJS.Platform, exists: (p: string) => boolean): string | null {
  const pathVar = env.PATH ?? env.Path ?? '';
  const names = platform === 'win32' ? [`${command}.exe`, command] : [command];
  for (const dir of pathVar.split(path.delimiter).filter((d) => d.length > 0)) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (exists(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

/**
 * Find cobc: `COBC_PATH` (must exist) → the first `cobc` on PATH → well-known
 * install dirs. Returns null when none runs `--version` successfully.
 */
export async function findCobc(options: CobcLocatorOptions = {}): Promise<CobcLocation | null> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const exists = options.exists ?? existsSync;
  const probe = options.probeVersion ?? probeCobcVersion;

  const candidates: string[] = [];
  const explicit = env[COBC_ENV_PATH_VAR];
  if (explicit && explicit.trim().length > 0) {
    candidates.push(explicit.trim());
  }
  const onPath = searchPath('cobc', env, platform, exists);
  if (onPath) {
    candidates.push(onPath);
  }
  candidates.push(...cobcCandidatePaths(platform));

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (seen.has(key) || !exists(candidate)) {
      continue;
    }
    seen.add(key);
    const banner = await probe(candidate);
    if (banner !== null) {
      return describeLocation(candidate, banner, exists);
    }
  }
  return null;
}

/**
 * Environment additions for running cobc and for launching what it built:
 * PATH gains cobc's bin dir (gcc + libcob DLLs on Windows/MSYS2), and the
 * config/copybook dirs are pinned when the install has them and the caller
 * has not set them.
 */
export function cobcEnvironment(
  location: CobcLocation,
  base: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }
  const pathKey = platform === 'win32' ? (Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH') : 'PATH';
  const current = env[pathKey] ?? '';
  const parts = current.split(path.delimiter).filter((p) => p.length > 0);
  if (!parts.some((p) => p.toLowerCase() === location.binDir.toLowerCase())) {
    env[pathKey] = [location.binDir, ...parts].join(path.delimiter);
  }
  if (location.configDir && !env.COB_CONFIG_DIR) {
    env.COB_CONFIG_DIR = location.configDir;
  }
  if (location.copyDir && !env.COB_COPY_DIR) {
    env.COB_COPY_DIR = location.copyDir;
  }
  return env;
}
