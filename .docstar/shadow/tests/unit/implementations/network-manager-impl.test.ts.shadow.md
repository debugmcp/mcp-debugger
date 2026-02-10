# tests/unit/implementations/network-manager-impl.test.ts
@source-hash: 404a514014ac913c
@generated: 2026-02-10T00:41:33Z

## Purpose
Unit test suite for NetworkManagerImpl class using Vitest testing framework. Tests network server creation and port discovery functionality with comprehensive mocking of Node.js net module.

## Key Test Structure
- **Test Suite**: `NetworkManagerImpl` (L39-188)
  - Tests for `createServer` method (L54-69)
  - Tests for `findFreePort` method (L71-187)

## Mock Infrastructure
- **mockServer**: Comprehensive mock object (L9-29) implementing full Node.js Server interface with all EventEmitter methods
- **net module mock**: Mocks `net.createServer` to return mockServer (L32-37)
- **beforeEach setup**: Resets all mocks and clears server state (L42-52)

## Test Coverage

### createServer Tests (L54-69)
- **Basic functionality**: Verifies server creation and net.createServer invocation (L55-60)
- **Error handling**: Tests exception propagation during server creation (L62-68)

### findFreePort Tests (L71-187)
- **Successful port discovery**: Tests complete flow with mock server lifecycle (L72-99)
  - Mocks server.listen with port 0 and callback execution
  - Mocks server.address returning port number
  - Verifies server cleanup with unref() and close()
- **Listen error handling**: Tests server error event propagation (L101-114)
- **Invalid address handling**: Tests string address format rejection (L116-136)
- **Null address handling**: Tests null address rejection (L138-158)
- **Resource cleanup verification**: Tests proper server cleanup on success (L160-186)

## Mock Patterns
- Uses `process.nextTick()` for asynchronous callback simulation
- Implements conditional callback execution based on parameter presence
- Comprehensive EventEmitter method mocking for complete interface coverage
- Type assertions using `as any` for TypeScript compatibility with mocks

## Dependencies
- Vitest testing framework with describe/it/expect/beforeEach/vi
- Node.js net module (mocked)
- NetworkManagerImpl from production code

## Test Architecture
- Isolation through vi.clearAllMocks() in beforeEach
- Complete interface mocking to prevent real network operations
- Async/await pattern for promise-based method testing
- Error simulation through mock implementation switching