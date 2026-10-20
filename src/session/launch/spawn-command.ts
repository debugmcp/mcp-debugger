/**
 * The adapter spawn command a launch would run, computed where the dry run is
 * answered (issue #812). Until the dry run became a parent-side query, this
 * string was built by the proxy worker from its init payload and logged just
 * before the worker exited; the formula is kept — the policy's spawn config,
 * rendered as `command args…` or `[connect] host:port` — so the answer reads
 * the same as it always did.
 */
import type { AdapterPolicy, AdapterSpawnPayload } from '@debugmcp/shared';
import type { ProxyConfig } from '../../proxy/proxy-config.js';

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
