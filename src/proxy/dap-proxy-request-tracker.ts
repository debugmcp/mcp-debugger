/**
 * Request tracking utility for managing DAP request timeouts
 */

import { IRequestTracker, TrackedRequest } from './dap-proxy-interfaces.js';

export class RequestTracker implements IRequestTracker {
  protected pendingRequests = new Map<string, TrackedRequest>();
  protected defaultTimeoutMs: number;

  constructor(defaultTimeoutMs: number = 30000) {
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  /**
   * Track a new request with timeout
   */
  track(requestId: string, command: string, timeoutMs?: number): void {
    // Clear any existing request with same ID
    this.complete(requestId);

    const timeout = timeoutMs ?? this.defaultTimeoutMs;
    const timer = setTimeout(() => {
      const request = this.pendingRequests.get(requestId);
      if (request) {
        this.pendingRequests.delete(requestId);
        // Base class has no timeout callback; see CallbackRequestTracker for callback support
      }
    }, timeout);

    this.pendingRequests.set(requestId, {
      requestId,
      command,
      timer,
      timestamp: Date.now()
    });
  }

  /**
   * Mark a request as completed and clear its timeout
   */
  complete(requestId: string): void {
    const request = this.pendingRequests.get(requestId);
    if (request) {
      clearTimeout(request.timer);
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    for (const request of this.pendingRequests.values()) {
      clearTimeout(request.timer);
    }
    this.pendingRequests.clear();
  }

  /**
   * Get all pending requests
   */
  getPending(): Map<string, TrackedRequest> {
    return new Map(this.pendingRequests);
  }

  /**
   * Get count of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Check if a specific request is pending
   */
  isPending(requestId: string): boolean {
    return this.pendingRequests.has(requestId);
  }

  /**
   * Get elapsed time for a request
   */
  getElapsedTime(requestId: string): number | null {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      return null;
    }
    return Date.now() - request.timestamp;
  }
}

/**
 * Enhanced request tracker with timeout callbacks
 */
export class CallbackRequestTracker extends RequestTracker {
  private onTimeout: (requestId: string, command: string) => void;

  constructor(
    onTimeout: (requestId: string, command: string) => void,
    defaultTimeoutMs: number = 30000
  ) {
    super(defaultTimeoutMs);
    this.onTimeout = onTimeout;
  }

  track(requestId: string, command: string, timeoutMs?: number): void {
    // Clear any existing request with same ID
    this.complete(requestId);

    const timeout = timeoutMs ?? this.defaultTimeoutMs;
    const timer = setTimeout(() => {
      const request = this.pendingRequests.get(requestId);
      if (request) {
        this.pendingRequests.delete(requestId);
        // Call the timeout handler
        this.onTimeout(requestId, command);
      }
    }, timeout);

    this.pendingRequests.set(requestId, {
      requestId,
      command,
      timer,
      timestamp: Date.now()
    });
  }

}
