# tests/vitest.setup.ts
@source-hash: c4755b8703c17965
@generated: 2026-02-10T00:42:00Z

**Purpose:** Global Vitest test configuration and setup file that initializes test environments, manages global state, and provides cross-platform compatibility for ESM-based tests.

**Key Components:**

- **Error Handling Setup (L12-18):** Configures global unhandled rejection/exception handlers to surface test failures with concise error messages during test execution
- **Console Output Configuration (L21):** Explicitly removes CONSOLE_OUTPUT_SILENCED environment variable to ensure test output visibility
- **Global Type Declarations (L24-29):** TypeScript declarations for `__dirname` and `testPortManager` globals to support ESM context and port management
- **ESM __dirname Polyfill (L32-39):** Cross-platform implementation that recreates `__dirname` functionality in ESM modules, with Windows-specific path normalization
- **Global Port Manager (L42):** Exposes `testPortManager` globally for test port allocation and cleanup across test files
- **Test Lifecycle Hooks:**
  - `beforeAll` (L45-48): Resets port manager state before each test file
  - `afterEach` (L51-54): Cleans up Vitest mocks after each individual test
  - `afterAll` (L57-70): Comprehensive cleanup including port manager reset and optional test server cleanup

**Dependencies:**
- `vitest` - Core testing framework and lifecycle hooks
- `./test-utils/helpers/port-manager.js` - Port allocation management utility
- `./test-utils/helpers/session-helpers.js` - Optional test server utilities (dynamically imported)

**Architecture Notes:**
- Uses dynamic import for session helpers to avoid hard dependencies
- Implements graceful error handling for optional cleanup operations
- Provides cross-platform path handling for Windows/Unix systems
- Maintains clean test isolation through systematic mock and state resets