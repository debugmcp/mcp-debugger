# tests/test-utils/mocks/net.ts
@source-hash: e4670aa744ae12a4
@generated: 2026-02-10T01:18:51Z

**Primary Purpose:** Mock implementation of Node.js `net` module for unit testing, providing a fake TCP server that simulates network operations without actual network activity.

**Key Components:**

- `mockNetServer` (L3-15): Mock TCP server object implementing core `net.Server` interface
  - `listen()` (L4-7): Simulates server listening on a port, immediately invokes callback
  - `close()` (L8-11): Simulates server shutdown, immediately invokes callback  
  - `on()` (L12): Mock event listener registration
  - `unref()` (L13): Mock for detaching server from event loop
  - `address()` (L14): Returns fixed mock address `127.0.0.1:12345` with IPv4 family

- `netMock` (L17-19): Main export implementing `net` module interface
  - `createServer()` (L18): Factory function returning the mock server instance

**Dependencies:**
- `vitest`: Testing framework providing `vi.fn()` for function mocking

**Architectural Pattern:**
- Factory pattern with fluent interface (methods return `mockNetServer` for chaining)
- Synchronous callback execution for deterministic test behavior
- Fixed return values for consistent test scenarios

**Test Usage:**
Designed to replace Node.js `net` module in unit tests, allowing tests to verify server lifecycle operations (start/stop) without actual network binding or port conflicts.