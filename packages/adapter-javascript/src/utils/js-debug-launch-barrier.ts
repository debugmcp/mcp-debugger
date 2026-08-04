import type { AdapterLaunchBarrier, ILogger } from '@debugmcp/shared';
import type { DebugProtocol } from '@vscode/debugprotocol';

const DEFAULT_TIMEOUT_MS = 5000;
const ADAPTER_CONNECTED_DELAY_MS = 500;

/**
 * Coordinates js-debug launch readiness by waiting for either a 'stopped' DAP
 * event or the adapter transport connection, mirroring the legacy behavior that
 * lived inside ProxyManager.
 */
export class JsDebugLaunchBarrier implements AdapterLaunchBarrier {
  readonly awaitResponse = false;

  private readonly logger?: ILogger;
  private readonly timeoutMs: number;
  private resolve!: () => void;
  private reject!: (error: Error) => void;
  private readonly promise: Promise<void>;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private adapterConnectedHandle: NodeJS.Timeout | null = null;
  private settled = false;

  constructor(logger?: ILogger, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.logger = logger;
    this.timeoutMs = timeoutMs;
    this.promise = new Promise<void>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    // ProxyManager can dispose the barrier before waitUntilReady() is ever
    // awaited (sendCommand-throw path); pre-attach a handler so the
    // dispose-time rejection never surfaces as an unhandled rejection.
    this.promise.catch(() => {});

    this.timeoutHandle = setTimeout(() => {
      if (this.settled) {
        return;
      }
      this.logger?.warn?.(
        `[JavascriptAdapter] js-debug launch timeout after ${this.timeoutMs}ms, proceeding anyway`
      );
      this.resolveBarrier();
    }, this.timeoutMs);
  }

  onRequestSent(requestId: string): void {
    this.logger?.info?.(
      `[JavascriptAdapter] js-debug launch request dispatched (requestId=${requestId})`
    );
  }

  onProxyStatus(status: string): void {
    if (this.settled || status !== 'adapter_connected') {
      return;
    }

    if (this.adapterConnectedHandle) {
      clearTimeout(this.adapterConnectedHandle);
    }

    this.adapterConnectedHandle = setTimeout(() => {
      if (this.settled) {
        return;
      }
      this.logger?.info?.(
        '[JavascriptAdapter] js-debug adapter connected; treating launch as ready'
      );
      this.resolveBarrier();
    }, ADAPTER_CONNECTED_DELAY_MS);
  }

  onDapEvent(event: string, _body: DebugProtocol.Event['body'] | undefined): void {
    if (this.settled) {
      return;
    }
    if (event === 'stopped') {
      this.logger?.info?.('[JavascriptAdapter] js-debug launch confirmed by stopped event');
      this.resolveBarrier();
      return;
    }
    // A debuggee that dies during the launch window ends the launch phase too.
    // Resolving (not rejecting) lets start_debugging return promptly with the
    // session's stopped state and exit code, matching other adapters (#242).
    if (event === 'terminated' || event === 'exited') {
      this.logger?.info?.(
        `[JavascriptAdapter] js-debug debuggee ${event} during launch; treating launch phase as complete`
      );
      this.resolveBarrier();
    }
  }

  onProxyExit(code: number | null, signal: string | null): void {
    if (this.settled) {
      return;
    }
    const error = new Error(
      `Proxy exited before js-debug launch completed (code=${code}, signal=${signal ?? 'null'})`
    );
    this.rejectBarrier(error);
  }

  waitUntilReady(): Promise<void> {
    return this.promise;
  }

  dispose(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    if (this.adapterConnectedHandle) {
      clearTimeout(this.adapterConnectedHandle);
      this.adapterConnectedHandle = null;
    }
    // Backstop: a dispose with the promise still pending would otherwise
    // orphan the awaiter forever (#242). Settle inline — resolveBarrier/
    // rejectBarrier call dispose() after setting `settled`, so routing
    // through rejectBarrier() here would re-enter.
    if (!this.settled) {
      this.settled = true;
      this.reject(new Error('js-debug launch barrier disposed before readiness'));
    }
  }

  private resolveBarrier(): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.dispose();
    this.resolve();
  }

  private rejectBarrier(error: Error): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.dispose();
    this.reject(error);
  }
}
