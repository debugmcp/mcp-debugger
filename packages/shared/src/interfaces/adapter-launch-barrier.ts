import type { DebugProtocol } from '@vscode/debugprotocol';

/**
 * Adapter-provided coordinator that can customize how a particular DAP request
 * is handled by ProxyManager. This enables language-specific launch
 * synchronization (e.g., js-debug) without coupling ProxyManager to a specific
 * adapter.
 */
export interface AdapterLaunchBarrier {
  /**
   * Whether ProxyManager should await the DAP response for this request.
   * When false, the adapter takes responsibility for signalling readiness via
   * the barrier and ProxyManager resolves the request once the barrier unlocks.
   */
  readonly awaitResponse: boolean;

  /**
   * Called after the DAP request is assigned a requestId but before it is sent.
   * Gives the barrier a chance to track the request.
   */
  onRequestSent(requestId: string): void;

  /**
   * Receives raw proxy status notifications (e.g., adapter_connected).
   */
  onProxyStatus(status: string, message: unknown): void;

  /**
   * Receives DAP events from the proxy.
   */
  onDapEvent(event: string, body: DebugProtocol.Event['body'] | undefined): void;

  /**
   * Receives proxy exit notifications so the barrier can fail fast if needed.
   */
  onProxyExit(code: number | null, signal: string | null): void;

  /**
   * Wait until the adapter signals readiness. Resolves when the request can be
   * considered complete from ProxyManager's perspective.
   */
  waitUntilReady(): Promise<void>;

  /**
   * Called when ProxyManager is cleaning up or when the barrier resolves.
   * Implementations should release timers/resources here.
   */
  dispose(): void;
}
