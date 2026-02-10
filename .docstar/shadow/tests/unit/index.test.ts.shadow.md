# tests/unit/index.test.ts
@source-hash: c1f475e2f859e171
@generated: 2026-02-10T00:42:00Z

## Purpose
Comprehensive unit test suite for the main entry point module (`src/index.js`), validating CLI setup, command handling, and server factory functionality using Vitest testing framework.

## Test Structure
- **Main Test Suite (L19-159)**: Tests for `index.ts` module with comprehensive mock setup
- **Mock Setup (L11-17, L23-52)**: Extensive mocking of all external dependencies including logger, server, CLI components, and command handlers
- **Test Categories**:
  - `createDebugMcpServer` factory function tests (L54-65)
  - `main` function CLI initialization tests (L67-135)
  - Module execution guard validation (L137-142)
  - Export availability verification (L144-158)

## Key Test Scenarios

### Server Factory Tests (L54-65)
- **Factory Function Test (L55-64)**: Validates `createDebugMcpServer` correctly instantiates `DebugMcpServer` with provided options
- Verifies constructor call and return value

### Main Function Tests (L67-135)
- **CLI Setup Test (L68-90)**: Validates complete CLI initialization sequence including logger creation, error handler setup, command registration, and argument parsing
- **STDIO Command Handler Test (L92-112)**: Captures and validates the handler function passed to `setupStdioCommand`, ensuring correct dependency injection
- **SSE Command Handler Test (L114-134)**: Similar validation for SSE command handler with port and logging options

## Mock Infrastructure
- **Logger Mock (L28-34)**: Complete logger interface with error, warn, info, debug methods
- **Program Mock (L37-39)**: CLI program with parse method
- **Dependency Mocks (L42-51)**: All CLI setup functions, version getter, and command handlers mocked to return expected values

## Test Dependencies
- **External Modules**: Tests integration with logger utils, server class, CLI components, error handlers, and command handlers
- **Vitest Framework**: Uses describe/it/expect/vi/beforeEach pattern with comprehensive mocking capabilities

## Validation Points
- Proper CLI configuration with name, description, and version
- Command handler dependency injection (logger and serverFactory)
- Module import behavior (no automatic execution)
- Export availability of all public functions

## Mock Reset Strategy
- `beforeEach` hook (L23-52) clears all mocks and establishes fresh mock state for each test
- Ensures test isolation and prevents cross-test contamination