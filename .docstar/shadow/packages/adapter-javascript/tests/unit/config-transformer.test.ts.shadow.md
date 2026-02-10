# packages/adapter-javascript/tests/unit/config-transformer.test.ts
@source-hash: 0e1e6336a01f2741
@generated: 2026-02-09T18:14:00Z

**Test file for config-transformer utilities in JavaScript adapter**

This test suite validates configuration transformation functions used by the JavaScript adapter, focusing on project type detection and output file determination. Tests use filesystem mocking for isolation.

## Core Components

**MockFileSystem class (L14-39)**: Test double implementing FileSystem interface with configurable mocks for existsSync and readFileSync operations. Provides `setExistsMock` and `setReadFileMock` methods to control filesystem behavior during tests.

## Test Suites

**determineOutFiles tests (L41-50)**: Validates output file pattern determination logic. Tests both custom outFiles arrays and default fallback behavior (`['**/*.js', '!**/node_modules/**']`).

**isESMProject tests (L52-130)**: Comprehensive ESM project detection testing with filesystem mocking setup (L57-68). Tests multiple ESM indicators:
- File extension detection (.mjs, .mts files)
- package.json `type: "module"` in program directory and cwd
- TypeScript config module settings (ESNext, NodeNext)
- Fallback to CommonJS when no indicators present

**hasTsConfigPaths tests (L132-187)**: Validates TypeScript path mapping detection by parsing tsconfig.json. Tests scenarios with populated paths, empty paths objects, and missing tsconfig files.

## Dependencies & Architecture

- **Vitest framework**: Standard test utilities (describe, it, expect, beforeEach, afterEach)
- **@debugmcp/shared**: FileSystem interface and NodeFileSystem implementation
- **config-transformer module**: Functions under test (determineOutFiles, isESMProject, hasTsConfigPaths, setDefaultFileSystem)

## Test Patterns

Each filesystem-dependent test suite follows consistent pattern:
1. Create MockFileSystem instance in beforeEach
2. Set default filesystem via setDefaultFileSystem
3. Configure mocks for specific test scenarios
4. Restore NodeFileSystem in afterEach

Critical for understanding how the adapter determines project configuration based on filesystem inspection and config file parsing.