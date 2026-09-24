import type { LaunchConfigDiagnostic } from '@debugmcp/shared';

/** Inputs the transform derives or consumes locally, rather than forwarding verbatim. */
export const JS_LAUNCH_CONSUMED_KEYS: ReadonlySet<string> = new Set([
  'program', 'args', 'cwd', 'env', 'envFile', 'stopOnEntry', 'justMyCode',
  'sourceMaps', 'outFiles', 'resolveSourceMapLocations', 'runtimeExecutable',
  'runtimeArgs', 'skipFiles', 'smartStep', '__workspaceFolder',
  '__workspaceCachePath', 'pauseForSourceMap', 'autoAttachChildProcesses',
  '__attachMode'
]);

/**
 * js-debug v1.112.0's node launch options (src/configuration.ts), plus our
 * generic/derived inputs. Editor-only tasks/console UI options are excluded.
 * Recognition is advisory: new upstream options remain reachable (#709).
 */
export const JS_SUPPORTED_LAUNCH_KEYS: readonly string[] = [
  ...JS_LAUNCH_CONSUMED_KEYS,
  'type', 'request', 'name', 'console', 'outputCapture', 'noDebug', 'trace',
  // Declared on js-debug's browser configs, but its breakpoint manager reads
  // it for every session, node launches included.
  'perScriptSourcemaps',
  'sourceMapPathOverrides', 'timeouts', 'timeout',
  'restart', 'runtimeVersion', 'nodeVersionHint', 'localRoot', 'remoteRoot',
  'rootPath', 'sourceMapRenames', 'runtimeSourcemapPausePatterns',
  'enableContentValidation', 'cascadeTerminateToConfigurations',
  'customDescriptionGenerator', 'customPropertiesGenerator',
  'showAsyncStacks', 'killBehavior', 'enableDWARF',
  'profileStartup', 'continueOnAttach', 'port', 'experimentalNetworking',
  '__remoteFilePrefix', '__breakOnConditionalError', '__pendingTargetId', 'attachSimplePort'
];

/** Validate only inputs we consume, before helpers can silently discard them or throw. */
export function normalizeJsLaunchInputs(
  config: Record<string, unknown>,
  diagnostics: LaunchConfigDiagnostic[]
): Record<string, unknown> {
  const result = { ...config };
  const invalid = (key: string, expected: string): void => {
    diagnostics.push({ key, message: `expected ${expected}; using the default` });
    delete result[key];
  };
  for (const key of ['program', 'cwd', 'runtimeExecutable', '__workspaceFolder', '__workspaceCachePath']) {
    if (result[key] !== undefined && typeof result[key] !== 'string') invalid(key, 'a string');
  }
  if (result.envFile !== undefined && result.envFile !== null && typeof result.envFile !== 'string') {
    invalid('envFile', 'a string or null');
  }
  for (const key of ['stopOnEntry', 'justMyCode', 'sourceMaps', 'smartStep', 'pauseForSourceMap', 'autoAttachChildProcesses']) {
    if (result[key] !== undefined && typeof result[key] !== 'boolean') invalid(key, 'a boolean');
  }
  for (const key of ['args', 'outFiles', 'runtimeArgs', 'skipFiles']) {
    const value = result[key];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      invalid(key, 'an array of strings');
    } else if (!value.every(item => typeof item === 'string')) {
      diagnostics.push({ key, message: 'expected an array of strings; ignored non-string entries' });
      result[key] = value.filter(item => typeof item === 'string');
    }
  }
  const locations = result.resolveSourceMapLocations;
  if (locations !== undefined && locations !== null &&
      !(Array.isArray(locations) && locations.every(item => typeof item === 'string'))) {
    invalid('resolveSourceMapLocations', 'null or an array of strings');
  }
  const env = result.env;
  if (env !== undefined && (env === null || typeof env !== 'object' || Array.isArray(env))) {
    invalid('env', 'an object of string or null values');
  }
  return result;
}
