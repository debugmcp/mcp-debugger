# packages/adapter-javascript/tests/unit/config-transformer.edge2.test.ts
@source-hash: 54d699504669f384
@generated: 2026-02-10T00:41:06Z

## Purpose
Unit test file for edge case scenarios in the config-transformer utility module, specifically focusing on branch-padding test cases for ESM project detection and TypeScript path configuration handling.

## Key Components

### MockFileSystem Class (L13-38)
Test double implementing the `FileSystem` interface with configurable mock behavior:
- `setExistsMock()` (L17-19): Configures file existence simulation
- `setReadFileMock()` (L21-23): Configures file content simulation
- `existsSync()` (L25-30): Returns mocked existence check or false by default
- `readFileSync()` (L32-37): Returns mocked file content or empty string by default

### Test Setup (L40-56)
- **Test suite**: "utils/config-transformer.edge2: branch-padding cases" 
- **Project paths**: Uses `proj-edge2` as test project directory with `src` subdirectory
- **beforeEach** (L45-51): Initializes MockFileSystem with default "no files exist" behavior
- **afterEach** (L53-56): Restores NodeFileSystem to prevent test pollution

### Test Cases

#### isESMProject Edge Cases (L58-86)
- **Empty program path test** (L58-66): Verifies ESM detection when programPath is empty and tsconfig.json has ESNext module in project root
- **Non-module package.json test** (L68-76): Confirms CommonJS type in package.json prevents ESM detection
- **CommonJS tsconfig test** (L78-86): Verifies CommonJS module setting in tsconfig prevents ESM detection

#### hasTsConfigPaths Edge Cases (L88-103)
- **Non-object paths handling** (L88-103): Tests behavior with invalid TypeScript paths configurations
- String paths return false (L92-96)
- Array paths return true due to implementation treating arrays as objects with enumerable keys (L98-102)

## Dependencies
- **vitest**: Testing framework (describe, it, expect, beforeEach, afterEach)
- **@debugmcp/shared**: FileSystem interface and NodeFileSystem implementation
- **config-transformer.js**: Functions under test (isESMProject, hasTsConfigPaths, setDefaultFileSystem)

## Test Strategy
Focuses on boundary conditions and edge cases that might not be covered in main test suites, particularly around file system interaction mocking and configuration parsing edge cases.