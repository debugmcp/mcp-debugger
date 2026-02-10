# tests/vitest.setup.ts
@source-hash: c4755b8703c17965
@generated: 2026-02-09T18:15:15Z

## Purpose
Global Vitest test setup file that configures the test environment, provides global utilities, and manages test lifecycle hooks across all test files.

## Key Components

### Global Error Handling (L13-18)
- `unhandledRejection` listener: Surfaces promise rejections with concise error messages
- `uncaughtException` listener: Captures and logs uncaught exceptions during test execution

### Environment Configuration (L21)
- Removes `CONSOLE_OUTPUT_SILENCED` environment variable to ensure console output is visible in tests

### Global Type Declarations (L24-29)
- `__dirname`: String type for directory path access in ESM context
- `testPortManager`: Typed reference to the port management utility

### ESM Compatibility Layer (L32-42)
- `__dirname` polyfill (L32-34): Creates directory path from `import.meta.url` with Windows path normalization
- Windows path formatting (L37-39): Converts forward slashes to backslashes on Windows platform
- Global port manager injection (L42): Makes `portManager` available as `testPortManager` globally

### Test Lifecycle Management

#### beforeAll Hook (L45-48)
- Resets port manager state before each test file execution
- References timeout configuration in `vitest.config.ts`

#### afterEach Hook (L51-54)
- `vi.resetAllMocks()`: Clears mock implementation and call history
- `vi.restoreAllMocks()`: Restores original function implementations

#### afterAll Hook (L57-70)
- Resets port manager state after test completion
- Conditionally imports and executes `cleanupTestServer()` from session helpers (L62-63)
- Graceful error handling for missing session helpers module (L66-68)

## Dependencies
- `vitest`: Testing framework utilities (vi, lifecycle hooks)
- `./test-utils/helpers/port-manager.js`: Port allocation management
- `./test-utils/helpers/session-helpers.js`: Optional session cleanup utilities (dynamic import)

## Architectural Patterns
- Global state management through `globalThis` injections
- Conditional module loading with error suppression
- Cross-platform path normalization for Windows/Unix compatibility
- Defensive programming with optional cleanup routines