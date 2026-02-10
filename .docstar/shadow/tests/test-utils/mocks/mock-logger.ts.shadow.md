# tests/test-utils/mocks/mock-logger.ts
@source-hash: 20965784c00bd3ac
@generated: 2026-02-10T00:41:27Z

## Purpose
Test utility providing mock logger implementations for test isolation and debugging.

## Key Functions

**createMockLogger(logLevel?: string): ILogger (L12-24)**
- Creates fully stubbed logger with Vitest mocks for all methods
- Default logLevel 'debug', attached as dynamic property for test assertions
- Returns silent mock suitable for unit tests requiring logger injection

**createSpyLogger(): ILogger (L31-38)**  
- Creates spy logger that both records calls AND outputs to console
- Useful for test debugging when you need to see actual log output
- Each method wraps console output with prefixed log level tags

## Dependencies
- `vitest` - Uses `vi.fn()` for creating mock/spy functions
- `ILogger` interface from `../../src/interfaces/external-dependencies.js` - Defines logger contract with info/error/debug/warn methods

## Architecture Notes
- Two distinct mocking strategies: silent vs. observable
- Type casting used for dynamic level property attachment (L21)
- Console methods directly mapped to corresponding log levels for realistic debugging experience

## Usage Patterns
- `createMockLogger()` for isolation testing where log output is irrelevant
- `createSpyLogger()` for integration tests or debugging where log visibility is needed
- Both return same interface, making them interchangeable in test scenarios