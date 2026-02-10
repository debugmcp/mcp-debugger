# tests/unit/implementations/network-manager-impl.test.ts
@source-hash: 404a514014ac913c
@generated: 2026-02-09T18:14:42Z

## Purpose
Unit test suite for `NetworkManagerImpl` class, testing network operations like server creation and free port detection. Uses Vitest testing framework with comprehensive mocking of Node.js `net` module.

## Test Structure
- **Main test suite**: `NetworkManagerImpl` (L39-188)
- **Test setup**: `beforeEach` hook (L42-52) creates fresh instance and clears all mocks
- **Mock configuration**: Comprehensive `net` module mock (L32-37) with `mockServer` object (L9-29)

## Key Test Groups

### createServer Tests (L54-69)
- **Basic functionality** (L55-60): Verifies server creation via `net.createServer()`
- **Error handling** (L62-68): Tests exception propagation during server creation

### findFreePort Tests (L71-187)
- **Happy path** (L72-99): Tests successful port discovery using ephemeral port (0)
- **Server listen errors** (L101-114): Tests error event handling during port binding
- **Invalid address formats** (L116-136): Tests string address handling (Unix sockets)
- **Null address handling** (L138-158): Tests null address return scenarios
- **Resource cleanup** (L160-186): Verifies proper server closure and resource management

## Mock Architecture
- **mockServer** (L9-29): Comprehensive Node.js Server interface mock with all EventEmitter methods
- **net module mock** (L32-37): Replaces `net.createServer()` to return `mockServer`
- **Dynamic mock behavior**: Tests configure mock implementations per scenario using `mockImplementation()`

## Key Testing Patterns
- **Async callback simulation**: Uses `process.nextTick()` to simulate Node.js async behavior
- **Event-driven testing**: Mocks EventEmitter patterns for error/success scenarios  
- **Resource lifecycle verification**: Ensures `unref()` and `close()` are called for cleanup
- **Error boundary testing**: Validates exception handling and rejection propagation

## Dependencies
- **Vitest**: Testing framework with mocking capabilities
- **Node.js net module**: Mocked for network operations
- **NetworkManagerImpl**: Implementation under test from `../../../src/implementations/network-manager-impl.js`