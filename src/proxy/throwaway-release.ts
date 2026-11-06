/**
 * The throwaway release (issues #501, #1082): the one lever that lets a
 * js-debug pending target run undebugged. The debug server unparks a pending
 * target only when a DAP connection attaches with its `__pendingTargetId` —
 * rejecting the report parks the child forever (measured,
 * docs/javascript/spike-notes-forks.md) — so a connection attaches, gives the
 * resume a moment to land, and detaches with `terminateDebuggee: false`.
 *
 * Never throws and never touches anything but the client it is given, which
 * it shuts down either way: a failed release must leave every other
 * connection of the worker intact.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { AdapterPolicy } from '@debugmcp/shared';
import type { IDapClient, ILogger } from './dap-proxy-interfaces.js';

/** The whole sequence, connect to detach. */
export const THROWAWAY_RELEASE_TIMEOUT_MS = 20_000;
const INITIALIZE_TIMEOUT_MS = 5_000;
const CONFIGURATION_DONE_TIMEOUT_MS = 5_000;
const ATTACH_TIMEOUT_MS = 15_000;
/** How long the resume gets to land before the detach (the policy's ready signal cuts it short). */
const READY_SIGNAL_TIMEOUT_MS = 1_500;
const DISCONNECT_TIMEOUT_MS = 3_000;

export interface ThrowawayReleaseOptions {
  /** A fresh client for the adapter's port, not yet connected; shut down by this function. */
  client: IDapClient;
  /** For the adapter id of the initialize and the ready signal (`isChildReadyEvent`). */
  policy: AdapterPolicy;
  /** The attach that names the pending target. */
  attachArguments: Record<string, unknown>;
  /** The target, for the log. */
  label: string;
  logger: ILogger;
  timeoutMs?: number;
}

/** Attach to the pending target and detach again; true when the target was resumed. */
export async function releaseByThrowawayAttach(options: ThrowawayReleaseOptions): Promise<boolean> {
  const { client, policy, attachArguments, label, logger } = options;
  const timeoutMs = options.timeoutMs ?? THROWAWAY_RELEASE_TIMEOUT_MS;
  try {
    await withTimeout((async () => {
      await client.connect();
      // js-debug rejects launch/attach before initialize; the pending-target
      // attach handler additionally awaits configurationDone.
      await client.sendRequest('initialize', {
        clientID: `mcp-release-${label}`,
        adapterID: policy.getDapAdapterConfiguration().type,
        pathFormat: 'path',
        linesStartAt1: true,
        columnsStartAt1: true
      }, INITIALIZE_TIMEOUT_MS);
      try {
        await client.sendRequest('configurationDone', {}, CONFIGURATION_DONE_TIMEOUT_MS);
      } catch {
        logger.warn(`[release:${label}] configurationDone failed or not required`);
      }
      logger.info(`[release:${label}] attach (throwaway connection)`);
      await client.sendRequest('attach', attachArguments, ATTACH_TIMEOUT_MS);
      // The resume runs just after the attach response resolves; wait for
      // the policy's ready signal so a fast disconnect cannot detach from a
      // target that is still parked.
      await waitForReadySignal(client, policy, READY_SIGNAL_TIMEOUT_MS);
      try {
        await client.sendRequest('disconnect', { terminateDebuggee: false }, DISCONNECT_TIMEOUT_MS);
      } catch {
        // Best effort — detaching is what matters, and shutdown() below
        // closes the socket either way.
      }
    })(), timeoutMs, `release of pending target ${label} timed out`);
    return true;
  } catch (error) {
    logger.error(`[release:${label}] Failed to release the pending target: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    try {
      client.shutdown('release complete');
    } catch {
      // The socket may already be gone.
    }
  }
}

/** Resolves true on the policy's child-ready signal, false on timeout or client death. */
function waitForReadySignal(client: IDapClient, policy: AdapterPolicy, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let done = false;
    const settle = (value: boolean): void => {
      if (done) return;
      done = true;
      client.off('event', onEvent);
      client.off('close', onDeath);
      client.off('error', onDeath);
      clearTimeout(timer);
      resolve(value);
    };
    const onEvent = (evt: DebugProtocol.Event): void => {
      if (evt && policy.isChildReadyEvent(evt)) {
        settle(true);
      }
    };
    const onDeath = (): void => settle(false);
    const timer = setTimeout(() => settle(false), timeoutMs);
    client.on('event', onEvent);
    client.on('close', onDeath);
    client.on('error', onDeath);
  });
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}
