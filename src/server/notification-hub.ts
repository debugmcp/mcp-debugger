/**
 * Process-wide fan-out for the MCP notifications a debug session produces
 * (issue #1025, step 2).
 *
 * The 2026-07-28 protocol serves one SDK `Server` per request, so nothing
 * that outlives a request can hang off a Server: the per-URI coalescer for
 * resources/updated pings and the list of parties to tell live here, on the
 * one shared core, and every protocol facade (or an HTTP handler's notifier)
 * attaches a sink for as long as it is open. Debounced so notification volume
 * is independent of debuggee output volume (issue #218).
 */
import type { Server } from '@modelcontextprotocol/server';
import type { ILogger } from '@debugmcp/shared';

/** Debounce window for resources/updated pings. */
export const OUTPUT_UPDATE_DEBOUNCE_MS = 150;

/** One party that receives the hub's notifications. */
export interface NotificationSink {
  resourceUpdated(uri: string): void | Promise<void>;
  resourcesChanged(): void | Promise<void>;
  /** The resource is gone (its session was removed): drop any per-sink state for it. */
  forget?(uri: string): void;
}

/** The subscription set a legacy facade filters its pings through. */
export interface ResourceSubscriptionFilter {
  has(uri: string): boolean;
  forget(uri: string): void;
}

export class NotificationHub {
  private readonly sinks = new Set<NotificationSink>();
  private readonly outputUpdateTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly logger: ILogger) {}

  /** How many sinks are attached (diagnostics and tests). */
  get sinkCount(): number {
    return this.sinks.size;
  }

  /** Attach a sink; the returned function detaches it. */
  addSink(sink: NotificationSink): () => void {
    this.sinks.add(sink);
    return () => {
      this.sinks.delete(sink);
    };
  }

  /**
   * Throttled resources/updated ping: the first event after a quiet period
   * arms a timer for that URI; everything that arrives inside the window
   * rides the same ping. Each sink decides for itself whether to send it.
   */
  resourceUpdated(uri: string): void {
    if (this.outputUpdateTimers.has(uri)) {
      return;
    }
    const timer = setTimeout(() => {
      this.outputUpdateTimers.delete(uri);
      for (const sink of this.sinks) {
        this.deliver(() => sink.resourceUpdated(uri), `[Server] Failed to send resources/updated for ${uri}`);
      }
    }, OUTPUT_UPDATE_DEBOUNCE_MS);
    timer.unref?.();
    this.outputUpdateTimers.set(uri, timer);
  }

  /** Fire-and-forget resources/list_changed to every sink (sessions appeared/disappeared). */
  resourcesChanged(): void {
    for (const sink of this.sinks) {
      this.deliver(() => sink.resourcesChanged(), '[Server] Failed to send resources/list_changed');
    }
  }

  /** The resource is gone: cancel its pending ping and let every sink drop it. */
  forgetUri(uri: string): void {
    this.clearTimer(uri);
    for (const sink of this.sinks) {
      // Runs inside the SessionManager's 'session-removed' emit (relaunch,
      // terminating detach): a sink's failure must not escape into those paths.
      this.deliver(() => sink.forget?.(uri), `[Server] Failed to forget ${uri}`);
    }
  }

  /**
   * Tear down: pending timers must not outlive the core (the test suite runs
   * with a strict leak guard), and no sink hears anything afterwards.
   */
  dispose(): void {
    for (const uri of [...this.outputUpdateTimers.keys()]) {
      this.clearTimer(uri);
    }
    this.sinks.clear();
  }

  /** A sink that cannot send (not connected yet, transport gone) is not an error. */
  private deliver(send: () => void | Promise<void>, what: string): void {
    try {
      const result = send();
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).catch((error: unknown) => {
          this.logger.debug(what, { error });
        });
      }
    } catch (error) {
      this.logger.debug(what, { error });
    }
  }

  private clearTimer(uri: string): void {
    const timer = this.outputUpdateTimers.get(uri);
    if (timer) {
      clearTimeout(timer);
      this.outputUpdateTimers.delete(uri);
    }
  }
}

/**
 * The sink a protocol facade attaches for its own SDK Server. With a filter
 * (a legacy-era facade) only the URIs that facade subscribed to through
 * resources/subscribe are pinged; without one (a modern-era pin, where the SDK
 * routes `sendResourceUpdated` onto the open subscriptions/listen stream and
 * filters by the listen set itself) every URI is.
 */
export function facadeSink(
  server: Pick<Server, 'sendResourceUpdated' | 'sendResourceListChanged'>,
  filter?: ResourceSubscriptionFilter
): NotificationSink {
  return {
    resourceUpdated: (uri: string) => {
      if (filter && !filter.has(uri)) {
        return;
      }
      return server.sendResourceUpdated({ uri });
    },
    resourcesChanged: () => server.sendResourceListChanged(),
    forget: (uri: string) => {
      filter?.forget(uri);
    }
  };
}
