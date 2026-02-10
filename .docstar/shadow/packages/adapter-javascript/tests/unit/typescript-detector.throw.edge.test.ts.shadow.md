# packages/adapter-javascript/tests/unit/typescript-detector.throw.edge.test.ts
@source-hash: 7e071c34d72cc105
@generated: 2026-02-09T18:14:05Z

## File: packages/adapter-javascript/tests/unit/typescript-detector.throw.edge.test.ts

**Purpose**: Edge case test suite for TypeScript binary detection under error conditions, specifically testing error handling and fallback behavior when filesystem operations throw exceptions.

**Key Test Framework**: Vitest test suite (L1) using `describe`, `it`, `expect`, `beforeEach`, `afterEach` pattern.

### Core Components:

**MockFileSystem class (L10-35)**:
- Implements FileSystem interface with configurable mock behaviors
- `existsMock` and `readFileMock` properties allow injecting custom behavior or errors
- `existsSync()` (L22-27) and `readFileSync()` (L29-34) delegate to mocks or return defaults
- Used to simulate filesystem errors during binary detection

**withPath() utility (L39-45)**:
- Temporarily modifies `process.env.PATH` for testing
- Returns cleanup function to restore original PATH
- Enables testing PATH-based binary resolution in isolation

### Test Environment Setup:

**beforeEach hook (L51-58)**:
- Creates fresh MockFileSystem instance
- Sets default behavior: no files exist, empty file reads
- Injects mock filesystem into typescript-detector module

**afterEach hook (L60-67)**:
- Restores original PATH if modified
- Restores NodeFileSystem as default filesystem
- Ensures clean state between tests

### Test Cases:

**Error fallback test (L69-102)**:
- **Scenario**: Local binary check throws exception, fallback to PATH succeeds
- **Setup**: Local `tsx.cmd` throws error (L86), PATH contains valid binary
- **Platform handling**: Windows expects `.cmd` suffix, POSIX expects bare executable
- **Assertion**: Verifies fallback mechanism works and returns PATH-resolved binary

**Complete failure test (L104-114)**:
- **Scenario**: All filesystem operations throw errors, no PATH available
- **Setup**: Empty PATH, all `existsSync` calls throw exceptions
- **Assertion**: Verifies graceful failure returns `undefined`

### Dependencies:
- `@debugmcp/shared` FileSystem interfaces
- `typescript-detector.js` module under test (`detectBinary`, `setDefaultFileSystem`)
- `executable-resolver.js` for Windows detection
- Standard Node.js `path` module

### Architecture Notes:
- Tests critical error paths in binary detection logic
- Platform-aware testing (Windows vs POSIX executable suffixes)
- Dependency injection pattern allows filesystem mocking
- Comprehensive cleanup ensures test isolation