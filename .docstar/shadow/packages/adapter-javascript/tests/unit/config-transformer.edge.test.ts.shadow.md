# packages/adapter-javascript/tests/unit/config-transformer.edge.test.ts
@source-hash: 05cd4b9e975baebc
@generated: 2026-02-09T18:13:59Z

## Purpose
Edge case test suite for config-transformer utilities, focusing on malformed JSON handling and error resilience. Tests ensure graceful failures when parsing corrupted configuration files.

## Key Classes and Functions

### MockFileSystem (L14-39)
Mock implementation of FileSystem interface for controlled testing scenarios.
- `setExistsMock()` (L18): Configures file existence behavior
- `setReadFileMock()` (L22): Configures file reading behavior  
- `existsSync()` (L26): Returns mocked file existence results
- `readFileSync()` (L33): Returns mocked file content

### Test Setup (L46-57)
- `beforeEach()` (L46): Initializes MockFileSystem, sets default "no files exist" behavior
- `afterEach()` (L54): Restores NodeFileSystem to prevent test pollution

## Test Cases

### isESMProject Malformed JSON Tests
- **Program dir package.json** (L59-68): Tests malformed JSON in nested package.json doesn't crash
- **Root tsconfig.json** (L70-78): Tests malformed tsconfig.json module detection doesn't crash

### hasTsConfigPaths Malformed JSON Test (L80-88)
Tests corrupted tsconfig.json with malformed paths configuration returns false gracefully

### determineOutFiles Default Pattern Test (L90-94)
Validates default output file patterns when no user configuration provided

## Dependencies
- `vitest`: Testing framework
- `@debugmcp/shared`: FileSystem interface and NodeFileSystem
- `config-transformer.js`: Functions under test (determineOutFiles, isESMProject, hasTsConfigPaths, setDefaultFileSystem)

## Testing Patterns
- **Malformed JSON resilience**: Primary focus on ensuring functions handle corrupted JSON without throwing
- **Filesystem mocking**: Uses dependency injection pattern via `setDefaultFileSystem()`
- **Path-specific mocking**: Mock functions check exact paths before returning configured responses
- **Graceful degradation**: All malformed JSON scenarios should return `false` rather than crash

## Critical Constraints
- Tests must restore original filesystem after each test to prevent side effects
- Mock filesystem defaults to "no files exist" to ensure predictable baseline behavior
- Malformed JSON inputs must not throw exceptions - functions should return default/false values