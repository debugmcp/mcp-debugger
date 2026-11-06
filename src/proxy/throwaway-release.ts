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
  let failure: Error | undefined;
  let timedOut = false;
  let rejectInterrupted!: (error: Error) => void;
  const interrupted = new Promise<never>((_, reject) => { rejectInterrupted = reject; });
  const interrupt = (error: Error): void => {
    if (failure) return;
    failure = error;
    rejectInterrupted(error);
  };
  // Own errors for the client's entire lifetime: MinimalDapClient emits a
  // socket failure after connect, even while an ordinary request is pending.
  const onError = (error: unknown): void => interrupt(error instanceof Error ? error : new Error(String(error)));
  const onClose = (): void => interrupt(new Error('release connection closed'));
  client.on('error', onError);
  client.on('close', onClose);
  const deadline = setTimeout(() => {
    timedOut = true;
    interrupt(new Error(`release of pending target ${label} timed out`));
  }, timeoutMs);
  // Race each step, so timeout/death stops this sequence itself. Merely racing
  // the outer operation lets a late connect/response continue after shutdown.
  const wait = <T>(operation: () => Promise<T>): Promise<T> => {
    if (failure) return Promise.reject(failure);
    return Promise.race([operation(), interrupted]);
  };
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => { resolveReady = resolve; });
  const onEvent = (event: DebugProtocol.Event): void => {
    if (policy.isChildReadyEvent(event)) resolveReady();
  };
  let readyTimer: NodeJS.Timeout | undefined;
  try {
    await wait(() => client.connect());
    // js-debug rejects launch/attach before initialize; the pending-target
    // attach handler additionally awaits configurationDone.
    await wait(() => client.sendRequest('initialize', {
      clientID: `mcp-release-${label}`,
      adapterID: policy.getDapAdapterConfiguration().type,
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true
    }, INITIALIZE_TIMEOUT_MS));
    try {
      await wait(() => client.sendRequest('configurationDone', {}, CONFIGURATION_DONE_TIMEOUT_MS));
    } catch (error) {
      if (failure) throw error;
      logger.warn(`[release:${label}] configurationDone failed or not required`);
    }
    // Listen before attach: the ready event can share a socket chunk with
    // its response, before the awaiting continuation gets to run.
    client.on('event', onEvent);
    logger.info(`[release:${label}] attach (throwaway connection)`);
    await wait(() => client.sendRequest('attach', attachArguments, ATTACH_TIMEOUT_MS));
    await wait(() => Promise.race([
      ready,
      new Promise<void>((resolve) => { readyTimer = setTimeout(resolve, READY_SIGNAL_TIMEOUT_MS); })
    ]));
    try {
      await wait(() => client.sendRequest('disconnect', { terminateDebuggee: false }, DISCONNECT_TIMEOUT_MS));
    } catch (error) {
      if (timedOut) throw error;
      // Best effort after the resume window: js-debug may close the socket
      // instead of answering disconnect. shutdown() closes it either way.
    }
    return true;
  } catch (error) {
    logger.error(`[release:${label}] Failed to release the pending target: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    clearTimeout(deadline);
    clearTimeout(readyTimer);
    client.off('event', onEvent);
    try {
      client.shutdown('release complete');
    } catch {
      // The socket may already be gone.
    }
    client.off('error', onError);
    client.off('close', onClose);
  }
}
