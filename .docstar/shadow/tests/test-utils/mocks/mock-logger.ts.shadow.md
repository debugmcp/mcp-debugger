# tests/test-utils/mocks/mock-logger.ts
@source-hash: 20965784c00bd3ac
@generated: 2026-02-09T18:14:36Z

## Purpose
Test utility module providing mock logger implementations for Vitest testing framework. Offers both silent mocks and console-logging spies for different testing scenarios.

## Key Components

### createMockLogger() (L12-24)
- **Purpose**: Creates fully stubbed logger with no output for unit tests
- **Parameters**: `logLevel` (optional, defaults to 'debug') - sets mock logger level
- **Returns**: ILogger instance with all methods as vi.fn() spies
- **Implementation**: Creates object with stubbed info/error/debug/warn methods, adds level property

### createSpyLogger() (L31-38)  
- **Purpose**: Creates logger that both records calls AND outputs to console for debugging
- **Returns**: ILogger instance with methods that call console equivalents while being spied
- **Use case**: Test debugging when you need to see actual log output

## Dependencies
- **Vitest**: `vi` from 'vitest' for creating function mocks/spies
- **ILogger**: Interface from `../../src/interfaces/external-dependencies.js` defining logger contract

## Architecture Notes
- Uses Vitest's `vi.fn()` for all mock implementations
- Both functions return objects conforming to ILogger interface
- createSpyLogger uses function chaining: `vi.fn(() => console.method())` to achieve dual behavior
- Type casting with `(logger as any).level` to add level property outside interface

## Usage Patterns
- Use createMockLogger() for standard unit tests where log output isn't needed
- Use createSpyLogger() for integration tests or debugging where log visibility is helpful