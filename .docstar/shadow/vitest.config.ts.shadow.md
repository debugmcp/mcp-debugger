# vitest.config.ts
@source-hash: 471e754816d5a15b
@generated: 2026-02-10T00:42:07Z

## Primary Purpose

Vitest configuration for a multi-package debugging framework project, providing comprehensive test environment setup with monorepo support, console output filtering, coverage reporting, and TypeScript/ESM module handling.

## Key Configuration Sections

### Test Environment (L4-139)
- **globals**: Enables global test functions like `describe`, `it` (L6)
- **environment**: Node.js runtime for backend testing (L7)
- **setupFiles**: Loads `./tests/vitest.setup.ts` for test initialization (L8)
- **include patterns**: Covers main project and packages test files (L10-15)
- **exclude patterns**: Filters out build artifacts and dependencies (L17-22)

### Reporting & Output (L24-87)
- **Conditional reporters**: Dot reporter for CI, default for local development (L24)
- **Console filtering**: Custom `onConsoleLog` function (L29-87) with sophisticated pattern matching:
  - **Important patterns**: Test failures, errors, specific test tags (L31-44)
  - **Noise patterns**: Build tools, debug output, timestamps (L50-74)
  - **Fallback logic**: Allows test file logs, suppresses stdout info/debug (L81-86)

### Performance & Parallelism (L89, L129-136)
- **fileParallelism**: Disabled for cleaner output (L89)
- **Single-threaded execution**: Essential for process spawning tests (L132-135)

### Coverage Configuration (L90-127)
- **Provider**: Istanbul for instrumentation (L91)
- **Extensive exclusions**: Test files, type definitions, CLI entry points, process-level files (L95-122)
- **Duplicate prevention**: `all: false` prevents multiple file tracking (L126)

### Module Resolution (L141-160)
- **TypeScript support**: Maps `.js` imports to `.ts` files (L145-148)
- **Monorepo aliases**: Package-scoped imports for `@debugmcp/*` packages (L152-158)
- **Path resolution**: Absolute paths to source directories

### ESM Optimization (L162-164)
- **Pre-bundling**: Debug adapter SDK and VSCode protocol modules

## Dependencies

- `vitest/config`: Test framework configuration
- `path`: Node.js path utilities for alias resolution

## Architectural Patterns

- **Monorepo structure**: Supports packages with individual test suites
- **Console noise reduction**: Sophisticated filtering for debugging framework output
- **TypeScript-first**: Comprehensive `.js` to `.ts` mapping for import resolution
- **Single-threaded testing**: Prevents race conditions in process spawning tests

## Critical Constraints

- Must run single-threaded due to process spawning in tests
- Console filtering is essential for managing debug framework verbosity
- Coverage excludes CLI and process-level code that requires integration testing