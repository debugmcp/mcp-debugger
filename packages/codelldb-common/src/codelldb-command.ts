/**
 * CodeLLDB spawn glue shared by every CodeLLDB-backed adapter (issue #324).
 *
 * Extracted from the Rust adapter so other native-language adapters can
 * compose the same behavior: TCP --port invocation, the --liblldb probe,
 * embedded-Python environment scrubbing, and the Windows space-in-path
 * mirror. Language-specific env additions (e.g. DLLTOOL, RUST_BACKTRACE)
 * stay in the calling adapter.
 */
import { existsSync } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';

/** Structural subset of the shared ILogger — keeps this package dependency-free. */
export interface CodeLLDBLogger {
  info?(message: string, ...meta: unknown[]): void;
  warn?(message: string, ...meta: unknown[]): void;
  debug?(message: string, ...meta: unknown[]): void;
}

export interface TerminalKindConfig {
  terminal?: 'console' | 'integrated' | 'external';
  console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';
}

/**
 * CodeLLDB's launch schema takes `terminal`; `console` is a legacy alias
 * carried over from the debugpy/js-debug convention (issue #223). Accept
 * either as input but always emit the canonical `terminal` key.
 */
export function resolveTerminalKind(config: TerminalKindConfig): NonNullable<TerminalKindConfig['terminal']> {
  if (config.terminal) {
    return config.terminal;
  }
  switch (config.console) {
    case 'integratedTerminal': return 'integrated';
    case 'externalTerminal': return 'external';
    case 'internalConsole':
    default:
      // 'console' captures the debuggee's stdio as DAP output events
      return 'console';
  }
}

function safeReadFile(filePath: string): string | null {
  try {
    return fsSync.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Windows only: CodeLLDB fails to start from paths containing spaces. When the
 * resolved executable lives under such a path, mirror the whole platform vendor
 * dir into a space-free location under the OS temp dir (version.json-gated so
 * the copy happens once per vendored version) and return the mirrored path.
 */
export function prepareCodelldbExecutablePath(
  originalPath: string | null,
  platform: NodeJS.Platform,
  logger?: CodeLLDBLogger
): string | null {
  if (!originalPath || platform !== 'win32' || !originalPath.includes(' ')) {
    return originalPath;
  }

  try {
    const platformDir = path.resolve(originalPath, '..', '..');
    const sanitizedRoot = path.join(os.tmpdir(), 'debug-mcp-codelldb');
    const sanitizedPlatformDir = path.join(sanitizedRoot, path.basename(platformDir));

    const sourceVersionPath = path.join(platformDir, 'version.json');
    const sanitizedVersionPath = path.join(sanitizedPlatformDir, 'version.json');
    const sourceVersion = safeReadFile(sourceVersionPath);
    const sanitizedVersion = safeReadFile(sanitizedVersionPath);

    if (!sanitizedVersion || sanitizedVersion !== sourceVersion) {
      fsSync.rmSync(sanitizedPlatformDir, { recursive: true, force: true });
      fsSync.mkdirSync(path.dirname(sanitizedPlatformDir), { recursive: true });
      fsSync.cpSync(platformDir, sanitizedPlatformDir, { recursive: true });
    }

    const sanitizedExecutable = path.join(
      sanitizedPlatformDir,
      path.relative(platformDir, originalPath)
    );

    if (existsSync(sanitizedExecutable)) {
      logger?.info?.('[codelldb-common] Using sanitized CodeLLDB path', {
        sanitizedExecutable,
        originalPath
      });
      return sanitizedExecutable;
    }
  } catch (error) {
    logger?.warn?.('[codelldb-common] Failed to prepare sanitized CodeLLDB path', error);
  }

  return originalPath;
}

/**
 * Build the CodeLLDB argv for TCP mode: `--port <n>` plus `--liblldb <path>`
 * when the vendored liblldb is present next to the adapter (points CodeLLDB at
 * its embedded Python runtime; only the Windows layout keeps it under lldb/bin).
 */
export function buildCodeLLDBArgs(
  codelldbPath: string,
  adapterPort: number,
  platform: NodeJS.Platform,
  logger?: CodeLLDBLogger
): string[] {
  const args = ['--port', String(adapterPort)];

  const libExt = platform === 'darwin' ? '.dylib' : platform === 'win32' ? '.dll' : '.so';
  const liblldbPath = path.resolve(path.dirname(codelldbPath), '..', 'lldb', 'bin', `liblldb${libExt}`);
  if (existsSync(liblldbPath)) {
    args.push('--liblldb', liblldbPath);
  } else {
    logger?.warn?.(`[codelldb-common] liblldb not found at ${liblldbPath}. Python visualizers may not work.`);
  }

  return args;
}

/**
 * Point the spawn environment at CodeLLDB's embedded Python: scrub host Python
 * variables that would shadow it and prepend the vendored runtime dirs to PATH.
 * No-op when the vendored lldb tree is absent (e.g. CODELLDB_PATH overrides).
 */
export function configurePythonEnvironment(
  env: Record<string, string>,
  adapterPath: string,
  logger?: CodeLLDBLogger
): void {
  try {
    const adapterDir = path.dirname(adapterPath);
    const vendorRoot = path.resolve(adapterDir, '..');
    const lldbRoot = path.resolve(vendorRoot, 'lldb');
    if (!existsSync(lldbRoot)) {
      return;
    }

    const adapterScriptsDir = path.join(adapterDir, 'scripts');
    const scrubbedVariables = ['PYTHONHOME', 'PYTHONPATH', 'CODELLDB_STARTUP'];
    for (const variable of scrubbedVariables) {
      if (Object.prototype.hasOwnProperty.call(env, variable)) {
        delete env[variable as keyof typeof env];
      }
    }

    const pathEntries = env.PATH
      ? env.PATH.split(path.delimiter).filter(Boolean)
      : [];
    const prependEntries = [
      path.join(lldbRoot, 'bin'),
      path.join(lldbRoot, 'DLLs'),
      path.join(adapterDir, 'DLLs'),
      adapterDir,
      adapterScriptsDir
    ].filter((dir) => existsSync(dir));

    for (const entry of prependEntries.reverse()) {
      if (!pathEntries.includes(entry)) {
        pathEntries.unshift(entry);
      }
    }

    env.PATH = pathEntries.join(path.delimiter);

    logger?.info?.('[codelldb-common] Configured embedded Python environment', {
      scrubbedVariables,
      addedPaths: prependEntries
    });
  } catch (error) {
    logger?.warn?.('[codelldb-common] Failed to configure embedded Python for CodeLLDB', error);
  }
}
