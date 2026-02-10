# tests/unit/index.test.ts
@source-hash: c1f475e2f859e171
@generated: 2026-02-09T18:15:13Z

Unit test suite for the main application entry point (`index.ts`). Provides comprehensive test coverage for CLI initialization, command setup, and module export verification using Vitest testing framework.

## Primary Purpose
Tests the main application bootstrap logic, ensuring proper CLI setup, command handler configuration, and module execution guards work correctly.

## Test Structure

### Mock Setup (L11-52)
- Extensive mocking of all dependencies using `vi.mock()` (L11-17)
- `beforeEach` hook (L23-52) configures mock implementations:
  - Mock logger with standard methods (L28-34)
  - Mock CLI program with parse method (L37-39)
  - Mock CLI setup functions (L42-44)
  - Mock version and command handlers (L46-51)

### Test Suites

#### `createDebugMcpServer` Tests (L54-65)
- Verifies factory function correctly instantiates `DebugMcpServer` with provided options
- Tests constructor parameter passing and return value

#### `main` Function Tests (L67-135)
- **CLI Setup Test (L68-90)**: Validates complete initialization sequence:
  - Logger creation with correct namespace
  - Error handler setup with logger dependency
  - CLI creation with application metadata
  - Command setup with proper handlers
  - Argument parsing execution

- **Stdio Command Handler Test (L92-112)**: Captures and tests the handler passed to `setupStdioCommand`, verifying it calls `handleStdioCommand` with correct dependencies (logger and server factory)

- **SSE Command Handler Test (L114-134)**: Similar pattern for SSE command handler, ensuring proper dependency injection

#### Module Execution Guard Tests (L137-142)
- Confirms that importing the module doesn't trigger `main` execution (import-time side effects prevention)

#### Export Verification Tests (L144-158)
- Validates all expected functions are properly exported and accessible
- Checks both direct exports (`main`, `createDebugMcpServer`) and re-exported dependencies

## Key Dependencies
- **Vitest**: Testing framework providing `describe`, `it`, `expect`, `vi`, `beforeEach`
- **Application modules**: Tests integration between index, logger, server, and CLI modules
- **Command handlers**: Tests stdio and SSE command integration

## Testing Patterns
- Comprehensive mocking strategy to isolate unit under test
- Dependency injection verification through captured function calls
- Handler function testing through mock implementation callbacks
- Export verification for module interface contracts