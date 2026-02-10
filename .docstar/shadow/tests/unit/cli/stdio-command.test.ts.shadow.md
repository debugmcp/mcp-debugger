# tests/unit/cli/stdio-command.test.ts
@source-hash: ee0861db5a04e08b
@generated: 2026-02-10T00:41:34Z

## Test Suite for STDIO Command Handler

**Primary Purpose:** Unit tests for the `handleStdioCommand` function that validates server startup behavior in STDIO mode with comprehensive mocking and error handling scenarios.

### Test Architecture (L8-150)
- **Test Subject:** `handleStdioCommand` from `../../../src/cli/stdio-command.js` (L2)
- **Dependencies:** Vitest testing framework, Winston logger types, DebugMcpServer (L1-4)
- **Mock Strategy:** Server factory pattern with dependency injection for testability (L6, L10, L34)

### Mock Setup (L14-38)
- **Mock Logger (L16-22):** Winston-compatible logger with all log level methods
- **Mock Server (L25-31):** DebugMcpServer with nested server.connect(), start(), and stop() methods
- **Mock Factory (L34):** Returns configured mock server instance
- **Mock Exit Process (L37):** Testable alternative to process.exit

### Test Scenarios

#### Happy Path Testing (L40-72)
- **Server Startup:** Validates successful STDIO mode initialization with log level setting
- **Verification Points:** Log level assignment, info logging, server factory invocation, server start, success confirmation

#### Configuration Handling (L74-92)
- **Optional Log Level:** Tests behavior when logLevel is not provided in options
- **State Preservation:** Ensures existing logger state remains unchanged when no new level specified

#### Error Handling (L94-112)
- **Server Start Failure:** Tests graceful handling of server.start() rejection
- **Error Recovery:** Validates error logging and process exit with code 1

#### Dependency Injection (L114-130)
- **Default Exit Behavior:** Tests fallback to process.exit when custom exitProcess not provided
- **Spy Integration:** Uses Vitest spies to verify process.exit calls

#### Factory Error Handling (L132-149)
- **Factory Exceptions:** Tests error handling when serverFactory throws during instantiation
- **Error Propagation:** Ensures factory errors are logged and cause proper exit behavior

### Key Testing Patterns
- **Dependency Injection:** All external dependencies (logger, serverFactory, exitProcess) are injectable for isolation
- **Async Testing:** All tests handle Promise-based operations with proper await patterns
- **Mock Verification:** Extensive use of `.toHaveBeenCalledWith()` for behavioral verification
- **Error Simulation:** Multiple error injection points to test resilience