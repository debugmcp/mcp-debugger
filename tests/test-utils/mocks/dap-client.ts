/**
 * Shared `IDapClient` double for the proxy-worker, go-initialized-fallback
 * and connection-manager tests: a real `EventEmitter` (so tests can `emit`
 * DAP events on it) whose `IDapClient` methods are all `vi.fn`s (so tests can
 * program and assert on them). Consumers see `IDapClient & EventEmitter`; a
 * member that changes shape or disappears fails here at compile time, but a
 * member ADDED to `IDapClient` must be added to this double by hand — the
 * construction is a type assertion, which passes when the target merely has
 * more members than the source (issue #691).
 */
import { vi, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import type { IDapClient } from '../../../src/proxy/dap-proxy-interfaces.js';

/**
 * What `createMockDapClient()` hands back. Each `IDapClient` method is also
 * the `vi.fn` it actually is, so `client.sendRequest.mockResolvedValue(...)`
 * needs no cast at the call site.
 */
export type MockDapClient = IDapClient & EventEmitter & {
  connect: Mock<IDapClient['connect']>;
  disconnect: Mock<IDapClient['disconnect']>;
  shutdown: Mock<IDapClient['shutdown']>;
  // Bare Mock on purpose: tests resolve partial DAP responses
  // ({ success: true }, undefined) and read raw mock.calls args, which the
  // real sendRequest<T extends DebugProtocol.Response> signature would reject.
  sendRequest: Mock;
  on: Mock<IDapClient['on']>;
  off: Mock<IDapClient['off']>;
  once: Mock<IDapClient['once']>;
  removeAllListeners: Mock<IDapClient['removeAllListeners']>;
};

export function createMockDapClient(): MockDapClient {
  const emitter = new EventEmitter();
  // Store original methods before wrapping
  const originalOn = emitter.on.bind(emitter);
  const originalOff = emitter.off.bind(emitter);
  const originalOnce = emitter.once.bind(emitter);
  const originalRemoveAllListeners = emitter.removeAllListeners.bind(emitter);

  // The listener wrappers return the double itself (it IS the emitter —
  // Object.assign mutates it), which is what the `this`-returning interface
  // promises and what keeps the assertion below comparable.
  const client: MockDapClient = Object.assign(emitter, {
    sendRequest: vi.fn().mockResolvedValue({ body: {} }),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      originalOn(event, handler);
      return client;
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      originalOff(event, handler);
      return client;
    }),
    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      originalOnce(event, handler);
      return client;
    }),
    removeAllListeners: vi.fn((event?: string) => {
      originalRemoveAllListeners(event);
      return client;
    }),
    shutdown: vi.fn()
  }) as MockDapClient;
  return client;
}
