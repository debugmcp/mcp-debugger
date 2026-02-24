# tests\unit\index.test.ts
@source-hash: 89a890d3aa629fc8
@generated: 2026-02-24T18:26:33Z

## Test Suite for Main Entry Point Module

Comprehensive unit tests for the `src/index.js` module, covering CLI initialization, command setup, and server factory function. Uses Vitest framework with extensive mocking to isolate the main function's orchestration logic.

### Test Structure

**Test Setup (L23-52)**: Configures mocks for all dependencies including logger, CLI program, command handlers, and version utilities. Creates mock objects with spy functions for verification.

**createDebugMcpServer Tests (L54-65)**: Verifies the server factory function correctly instantiates `DebugMcpServer` with provided options and returns the instance.

**main Function Tests (L67-135)**: 
- **Basic Flow (L68-90)**: Tests complete CLI setup sequence including logger creation, error handler setup, CLI creation with metadata, command registration, and argument parsing
- **STDIO Handler Integration (L92-112)**: Captures and tests the handler function passed to `setupStdioCommand`, verifying it calls `handleStdioCommand` with correct dependencies 
- **SSE Handler Integration (L114-134)**: Similar test for SSE command handler, ensuring proper dependency injection

**Module Execution Guard (L137-142)**: Ensures the main function doesn't execute when the module is imported (vs run directly).

**Export Verification (L144-158)**: Confirms all expected functions are properly exported and accessible.

### Testing Patterns

- **Comprehensive Mocking**: All external dependencies mocked using `vi.mock()` (L11-17)
- **Handler Capture Pattern**: Tests capture callback functions passed to setup methods to verify their behavior independently
- **Dependency Injection Testing**: Verifies that handlers receive correct logger and serverFactory dependencies
- **Import-time Safety**: Tests that importing the module doesn't trigger side effects

### Key Dependencies Mocked

- Logger utilities, server classes, error handlers, CLI setup functions, command handlers, and version utilities - enabling isolated testing of the main orchestration logic.