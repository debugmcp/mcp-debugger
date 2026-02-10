# packages/adapter-javascript/tests/unit/executable-resolver.test.ts
@source-hash: 98bc22d95366c7b4
@generated: 2026-02-09T18:14:00Z

## Test Suite for Executable Resolver Utilities

**Primary Purpose**: Comprehensive unit test suite for `executable-resolver.js` utilities, specifically testing Node.js executable discovery and PATH-based executable resolution across different operating systems.

**Key Test Components**:

- **MockFileSystem (L11-24)**: Test double implementing `FileSystem` interface with configurable `existsSync` behavior via `setExistsMock()`. Enables controlled simulation of file system states without actual file operations.

- **withPath helper (L26-32)**: Environment manipulation utility that temporarily modifies `process.env.PATH` and returns a cleanup function. Essential for testing PATH-based resolution scenarios.

- **Test Setup (L38-53)**: Establishes isolated test environment by injecting `MockFileSystem` as default file system, with proper cleanup to restore `NodeFileSystem` after each test.

**Core Test Scenarios**:

1. **Default Node Resolution (L55-60)**: Verifies `findNode()` returns `process.execPath` when it exists and no preferred path is specified
2. **Preferred Path Precedence (L62-68)**: Confirms explicit preferred paths override default behavior when they exist
3. **PATH Fallback Logic (L70-86)**: Tests PATH-based discovery when `process.execPath` is unavailable, verifying directory precedence
4. **Cross-platform PATH Resolution (L88-106)**: Validates `whichInPath()` behavior with multiple candidates, ensuring directory-first then name-order precedence
5. **Fallback Behavior (L108-115)**: Tests deterministic fallback to `process.execPath` when no valid executables are found

**Dependencies**:
- `@debugmcp/shared` (FileSystem interfaces)
- `../../src/utils/executable-resolver.js` (functions under test)
- vitest testing framework

**Architecture Patterns**:
- Dependency injection via `setDefaultFileSystem()` for testability
- Cross-platform testing with `isWindows()` checks for executable extensions
- Environment isolation with proper setup/teardown lifecycle

**Critical Test Invariants**:
- All tests restore original environment state via `afterEach`
- Mock file system provides deterministic file existence behavior
- PATH manipulation is properly scoped and cleaned up