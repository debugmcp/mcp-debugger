/**
 * Shared `IDapClient` double for the proxy-worker, go-initialized-fallback
 * and connection-manager tests: a real `EventEmitter` (so tests can `emit`
 * DAP events on it) whose `IDapClient` methods are all `vi.fn`s (so tests can
 * program and assert on them). Typed against the interface (a plain annotated
 * assignment, no assertion): a member `IDapClient` gains or loses fails here
 * (a required addition is missing from the assembled object; a removal breaks
 * the `IDapClient['x']` types). Shape drift is caught here only for the four
 * listener wrappers, whose implementations are typed — `connect`/`disconnect`/
 * `shutdown` are bare `vi.fn()`s and `sendRequest` is deliberately bare
 * `Mock`, so their drift surfaces at consumers' typed `.mockResolvedValue(...)`
 * sites and at `MinimalDapClient implements IDapClient`, not here (issue #691).
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
  const originalRemoveAllListeners = emitter.removeAllListeners.bind(emitter);

  // The listener wrappers return the double itself (it IS the emitter —
  // Object.assign mutates it), which is what the `this`-returning interface
  // promises and what lets the assignment below type-check without a cast.
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
    // Not EventEmitter's own once(): that goes through `this.on(...)`, i.e.
    // the vi.fn wrapper above, so every once() would also record a spurious
    // on() call. Register the self-removing wrapper via the captured
    // prototype methods instead.
    once: vi.fn<IDapClient['once']>((event, handler) => {
      const onceWrapper = (...args: unknown[]) => {
        originalOff(event, onceWrapper);
        handler(...args);
      };
      // Node EventEmitter.once parity: off(event, handler) also removes the wrapper.
      Object.assign(onceWrapper, { listener: handler });
      originalOn(event, onceWrapper);
      return client;
    }),
    removeAllListeners: vi.fn((event?: string) => {
      originalRemoveAllListeners(event);
      return client;
    }),
    shutdown: vi.fn()
  });
  return client;
}
