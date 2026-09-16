/**
 * Shared `IDapClient` double for the proxy-worker and connection-manager
 * tests: a real `EventEmitter` (so tests can `emit` DAP events on it) whose
 * `IDapClient` methods are all `vi.fn`s (so tests can program and assert on
 * them). Typed against the interface, so the compiler rejects it the moment
 * `IDapClient` moves (issue #691).
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
  // Bare Mock too: tests replace `on` with a handler-capturing implementation
  // that returns nothing, which a `this`-returning signature would reject.
  on: Mock;
  off: Mock;
  once: Mock;
  removeAllListeners: Mock;
};

export function createMockDapClient(): MockDapClient {
  const emitter = new EventEmitter();
  // Store original methods before wrapping
  const originalOn = emitter.on.bind(emitter);
  const originalOff = emitter.off.bind(emitter);
  const originalOnce = emitter.once.bind(emitter);
  const originalRemoveAllListeners = emitter.removeAllListeners.bind(emitter);

  return Object.assign(emitter, {
    sendRequest: vi.fn().mockResolvedValue({ body: {} }),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      originalOn(event, handler);
      return emitter;
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      originalOff(event, handler);
      return emitter;
    }),
    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      originalOnce(event, handler);
      return emitter;
    }),
    removeAllListeners: vi.fn((event?: string) => {
      originalRemoveAllListeners(event);
      return emitter;
    }),
    shutdown: vi.fn()
  }) as MockDapClient;
}
