# packages/adapter-javascript/tests/unit/config-transformer.test.ts
@source-hash: 0e1e6336a01f2741
@generated: 2026-02-10T00:41:10Z

Test suite for config-transformer utility functions that handle TypeScript/JavaScript project configuration detection and file output patterns.

## Primary Purpose
Unit tests for three core functions in the config-transformer module that analyze project structure and configuration to make build decisions.

## Key Test Classes

**MockFileSystem (L14-39)**: Test double implementing FileSystem interface
- `setExistsMock(mock)` (L18): Sets custom file existence behavior  
- `setReadFileMock(mock)` (L22): Sets custom file reading behavior
- `existsSync(path)` (L26): Returns mocked existence result or false
- `readFileSync(path, encoding)` (L33): Returns mocked file content or empty string

## Test Suites

**determineOutFiles Tests (L41-50)**: Validates output file pattern logic
- Tests custom outFiles pass-through (L42-45)
- Tests default pattern fallback: `['**/*.js', '!**/node_modules/**']` (L47-49)

**isESMProject Tests (L52-130)**: Comprehensive ESM project detection
- File extension detection: `.mjs` (L70-72), `.mts` (L74-76) 
- package.json analysis: `type: "module"` in program dir (L78-88) or cwd (L90-100)
- tsconfig.json analysis: `module: "ESNext"` (L102-112) or `module: "NodeNext"` (L114-124)
- Fallback behavior when no indicators present (L126-129)

**hasTsConfigPaths Tests (L132-187)**: TypeScript path mapping detection
- Detects non-empty `compilerOptions.paths` configuration (L149-165)
- Handles empty paths object (L167-181)
- Handles missing tsconfig.json (L183-186)

## Dependencies
- **vitest**: Test framework (`describe`, `it`, `expect`, `beforeEach`, `afterEach`)
- **@debugmcp/shared**: FileSystem interface and NodeFileSystem implementation
- **config-transformer.js**: Functions under test

## Test Patterns
- Each test suite uses MockFileSystem with setup/teardown (beforeEach/afterEach)
- Default filesystem restored after each test to prevent interference
- JSON.stringify used to mock configuration file contents
- Path.join for cross-platform path handling

## Key Behaviors Tested
- ESM detection hierarchy: file extension → package.json → tsconfig.json
- Configuration file lookup in both program directory and project root
- TypeScript module resolution compatibility (ESNext, NodeNext)
- Path mapping presence validation for build optimization decisions