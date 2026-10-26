/**
 * The adapter spawn command a launch would run, computed where the dry run is
 * answered (issue #812). Until the dry run became a parent-side query, this
 * string was built by the proxy worker from its init payload and logged just
 * before the worker exited; the formula is kept — the policy's spawn config,
 * rendered as `command args…` or `[connect] host:port` — so the answer reads
 * the same as it always did.
 */
import { launchTargetKeysOf, type AdapterPolicy, type AdapterSpawnPayload } from '@debugmcp/shared';
import type { ProxyConfig } from '../../proxy/proxy-config.js';

/** A code-string target longer than this is cut in the dry run's `script`. */
const TARGET_PREVIEW_LENGTH = 60;

/**
 * What the launch runs, for the dry run's `script` (issue #985): the program
 * when the transformed config carries one; else the first non-program target
 * the policy's launch-target keys name (`module: pytest`, `code: …` — a long
 * code string truncated); else the payload's scriptPath, the stand-in file a
 * module launch only uses to say which file it is about.
 */
export function describeLaunchTarget(
  policy: Pick<AdapterPolicy, 'launchTargetKeys'>,
  config: Pick<SpawnCommandSource, 'scriptPath' | 'launchConfig'>
): string {
  const launchConfig = config.launchConfig ?? {};
  for (const key of launchTargetKeysOf(policy)) {
    const value = launchConfig[key];
    const text = typeof value === 'string' ? value : Array.isArray(value) ? value.map(String).join(' ') : '';
    if (text.length === 0) {
      continue;
    }
    if (key === 'program') {
      return text;
    }
    const preview = text.length > TARGET_PREVIEW_LENGTH ? `${text.slice(0, TARGET_PREVIEW_LENGTH)}…` : text;
    return `${key}: ${preview}`;
  }
  return config.scriptPath;
}

/**
 * The ProxyConfig fields the policy's spawn config reads — the worker's init
 * payload minus what only a running proxy needs.
 */
export type SpawnCommandSource = Pick<
  ProxyConfig,
  'executablePath' | 'adapterHost' | 'adapterPort' | 'logDir' | 'scriptPath' | 'launchConfig' | 'adapterCommand'
>;

/**
 * Render the command the proxy worker would spawn (or the endpoint it would
 * connect to) for this configuration. Throws, naming the policy, when the
 * policy cannot say — the worker refused the same way.
 */
export function describeSpawnCommand(
  policy: Pick<AdapterPolicy, 'name' | 'getAdapterSpawnConfig'>,
  config: SpawnCommandSource
): string {
  const payload: AdapterSpawnPayload = {
    executablePath: config.executablePath ?? '',
    adapterHost: config.adapterHost,
    adapterPort: config.adapterPort,
    logDir: config.logDir,
    scriptPath: config.scriptPath,
    launchConfig: config.launchConfig,
    adapterCommand: config.adapterCommand
  };
  const spawn = policy.getAdapterSpawnConfig?.(payload);
  if (!spawn) {
    throw new Error(`Cannot determine adapter command for dry run (policy: ${policy.name})`);
  }
  return spawn.mode === 'connect'
    ? `[connect] ${spawn.host}:${spawn.port}`
    : `${spawn.command} ${spawn.args.join(' ')}`;
}
