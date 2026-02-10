# tests/unit/implementations/__mocks__/
@generated: 2026-02-09T18:16:01Z

## Purpose
This directory contains Jest/Vitest manual mocks for Node.js modules used in unit testing. It provides controlled test doubles for system-level operations that would otherwise perform actual filesystem operations or process spawning during tests.

## Key Components
- **child_process.js**: Jest mock replacing Node.js `child_process` module functions (`spawn`, `exec`)
- **fs-extra.js**: Vitest mock replacing the `fs-extra` filesystem library with controllable test doubles

## Public API Surface
The directory follows Jest/Vitest manual mocking conventions where mocks are automatically applied when the corresponding real modules are imported in tests:

- **child_process mock**: Provides `spawn()` and `exec()` mock functions
- **fs-extra mock**: Comprehensive mocking of filesystem operations including:
  - File operations: `readFile`, `writeFile`, `stat`, `unlink`, `access`
  - Directory operations: `ensureDir`, `mkdir`, `rmdir`, `readdir`
  - Stream operations: `createReadStream`, `createWriteStream`
  - Utility operations: `pathExists`, `existsSync`, `remove`, `copy`, `move`
  - JSON operations: `outputJson`, `readJson`

## Internal Organization
- Located in `__mocks__` directory following testing framework conventions
- Each mock file corresponds to a specific Node.js module being replaced
- Uses framework-specific mock utilities (`jest.fn()`, `vi.fn()`)
- Supports both named and default import patterns for maximum compatibility

## Data Flow
Mocks are automatically activated when their corresponding real modules are imported in test files. This enables:
- Verification of function calls without side effects
- Controlled simulation of success/failure scenarios
- Isolation of units under test from external dependencies
- Safe testing of error conditions and edge cases

## Important Patterns
- Manual mocks override automatic mocks when present in `__mocks__` directory
- Each mock provides the same API surface as the real module
- Mock functions can be programmatically controlled and inspected in tests
- Dual export pattern ensures compatibility with different import styles