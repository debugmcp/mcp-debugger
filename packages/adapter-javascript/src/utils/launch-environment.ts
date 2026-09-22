import path from 'node:path';
import { parse } from 'dotenv';
import type { LaunchConfigDiagnostic } from '@debugmcp/shared';

type LaunchEnvironment = Record<string, string | null>;

interface EnvironmentInputs {
  /** Already stripped of a parent debugger's exit-code shim. */
  inherited: Record<string, string>;
  env?: unknown;
  envFile?: unknown;
  cwd: string;
  readFile: (file: string) => Promise<string>;
  diagnostics: LaunchConfigDiagnostic[];
  platform?: NodeJS.Platform;
}

/**
 * Resolve debuggee environment precedence without changing the server's env.
 * Null stays in the DAP map: omission would re-inherit js-debug's own env.
 */
export async function resolveLaunchEnvironment(inputs: EnvironmentInputs): Promise<LaunchEnvironment> {
  const { diagnostics } = inputs;
  const windows = (inputs.platform ?? process.platform) === 'win32';
  const result: LaunchEnvironment = {};
  const set = (key: string, value: string | null): void => {
    if (windows) {
      for (const existing of Object.keys(result)) {
        if (existing.toUpperCase() === key.toUpperCase()) delete result[existing];
      }
      // These are subsequently read/stamped by the exit-code shim setup.
      if (['NODE_ENV', 'NODE_OPTIONS', 'MCP_DEBUGGER_EXITCODE_FILE', 'MCP_DEBUGGER_EXITCODE_CLAIMED'].includes(key.toUpperCase())) {
        key = key.toUpperCase();
      }
    }
    Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true });
  };
  for (const [key, value] of Object.entries(inputs.inherited)) set(key, value);
  // Preserve the existing fallback, but a file or explicit env can override/unset it.
  set('NODE_ENV', 'development');

  if (typeof inputs.envFile === 'string' && inputs.envFile.length > 0) {
    try {
      const contents = await inputs.readFile(path.resolve(inputs.cwd, inputs.envFile));
      for (const [key, value] of Object.entries(parse(contents.replace(/^\uFEFF/, '')))) set(key, value);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        // File contents and arbitrary reader error messages can contain secrets.
        throw new Error(`Cannot read envFile (${code ?? 'read failed'})`);
      }
      diagnostics.push({ key: 'envFile', message: 'file was not found; using inherited and explicit environment settings' });
    }
  }
  if (inputs.env && typeof inputs.env === 'object' && !Array.isArray(inputs.env)) {
    let invalidValue = false;
    for (const [key, value] of Object.entries(inputs.env)) {
      if (typeof value === 'string' || value === null) set(key, value);
      else invalidValue = true;
    }
    if (invalidValue) diagnostics.push({ key: 'env', message: 'ignored entries whose values are neither strings nor null' });
  }
  return result;
}
