# tests/test-utils/mocks/net.ts
@source-hash: b2894cec04f2d9d9
@generated: 2026-02-09T18:14:38Z

## Purpose
Test utility mock for Node.js `net` module, providing a fully stubbed TCP server implementation for unit testing scenarios.

## Key Components

### mockNetServer (L4-16)
Mock TCP server object that mimics Node.js `net.Server` behavior:
- **listen** (L5-8): Mock server binding function, accepts port and optional callback, returns self for chaining
- **close** (L9-12): Mock server shutdown function with optional error callback, returns self for chaining  
- **on** (L13): Event listener registration stub using vitest mock function
- **unref** (L14): Server reference management stub
- **address** (L15): Returns fixed mock address object `{port: 12345, family: 'IPv4', address: '127.0.0.1'}`

### netMock (L18-21)
Primary export object containing:
- **createServer** (L19): Factory function returning the mockNetServer instance

## Dependencies
- **vitest**: Test framework providing `vi.fn()` mock functions for spying/stubbing
- **events**: Node.js EventEmitter (imported but not directly used in current implementation)

## Usage Pattern
Designed to replace Node.js `net` module in test environments, allowing tests to verify server creation, binding, and lifecycle operations without actual network socket creation.

## Architectural Notes
- Uses vitest's function mocking system for comprehensive call tracking
- Implements fluent interface pattern (method chaining) matching Node.js net.Server API
- Provides deterministic address response for predictable test assertions