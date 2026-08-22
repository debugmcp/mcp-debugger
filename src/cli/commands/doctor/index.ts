/**
 * Handler for `mcp-debugger doctor` (issue #423).
 *
 * console.* is noop'd process-wide before any import runs (src/index.ts), so
 * all output goes through process.stdout/stderr writes — the same pattern as
 * check-rust-binary. The exit code is returned (the wiring assigns it to
 * process.exitCode); process.exit is only forced when a probe timed out,
 * because a hung toolchain child can otherwise keep the event loop alive
 * forever.
 */
import type { IEnvironment, IFileSystem, ILogger } from '@debugmcp/shared';
import { createProductionDependencies } from '../../../container/dependencies.js';
import { getVersion } from '../../version.js';
import { diagnose, type DoctorRegistry } from './diagnose.js';
import { formatHumanReport, formatJsonReport } from './format.js';
import type { DoctorOptions } from '../../setup.js';

export interface DoctorDependencies {
  adapterRegistry: unknown;
  environment: IEnvironment;
  fileSystem: IFileSystem;
  logger: ILogger;
  disposeLogger?: () => void;
}

export interface DoctorHandlerOverrides {
  createDependencies?: () => DoctorDependencies;
  writeOutput?: (text: string) => void;
  writeError?: (text: string) => void;
  /** Invoked only when a probe timed out (hung-child containment). */
  exit?: (code: number) => void;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}

function defaultWriteOutput(text: string): void {
  process.stdout.write(text);
  if (!text.endsWith('\n')) {
    process.stdout.write('\n');
  }
}

function defaultWriteError(text: string): void {
  process.stderr.write(`${text}\n`);
}

/** Let stdout flush before a forced exit (Windows pipes drop unflushed data). */
function drainStdout(): Promise<void> {
  return new Promise((resolve) => {
    process.stdout.write('', () => resolve());
  });
}

export async function handleDoctorCommand(
  languages: string[],
  options: DoctorOptions = {},
  overrides: DoctorHandlerOverrides = {}
): Promise<number> {
  const writeOutput = overrides.writeOutput ?? defaultWriteOutput;
  const writeError = overrides.writeError ?? defaultWriteError;
  const exit = overrides.exit ?? ((code: number) => process.exit(code));

  const timeoutRaw = options.timeout ?? '10000';
  const timeoutMs = Number.parseInt(timeoutRaw, 10);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    writeError(`Invalid --timeout value: '${timeoutRaw}' (expected a positive number of milliseconds)`);
    return 2;
  }

  let deps: DoctorDependencies | undefined;
  try {
    const createDependencies =
      overrides.createDependencies ?? (() => createProductionDependencies({ logLevel: 'error' }));
    deps = createDependencies();

    const registry = deps.adapterRegistry as DoctorRegistry;
    if (
      typeof registry?.listAvailableAdapters !== 'function' ||
      typeof registry?.getFactory !== 'function'
    ) {
      throw new Error('The adapter registry does not support doctor probing');
    }

    const report = await diagnose(languages, {
      registry,
      environment: deps.environment,
      fileSystem: deps.fileSystem,
      env: overrides.env,
      platform: overrides.platform,
      timeoutMs,
      version: getVersion(),
      logger: deps.logger
    });

    writeOutput(options.json ? formatJsonReport(report) : formatHumanReport(report));

    if (report.languages.some((diagnosis) => diagnosis.probe.timedOut)) {
      // A timed-out validate may have left a hung child holding the event
      // loop; report honestly, then leave.
      await drainStdout();
      exit(report.exitCode);
    }
    return report.exitCode;
  } catch (error) {
    writeError(error instanceof Error ? error.message : String(error));
    return 2;
  } finally {
    deps?.disposeLogger?.();
  }
}
