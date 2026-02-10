# packages/adapter-javascript/tests/unit/executable-resolver.throw.edge.test.ts
@source-hash: a0b24eacf2d3d732
@generated: 2026-02-09T18:14:00Z

**Primary Purpose:** Edge case and error handling test suite for executable-resolver utilities, specifically testing throw conditions and path resolution fallback mechanisms.

**Test Structure:**
- MockFileSystem class (L9-34): Test double implementing FileSystem interface with injectable mock behaviors for `existsSync` and `readFileSync`
- Test helper `withPath()` (L38-44): Environment variable manipulation utility for PATH testing
- Main test suite (L46-162): Four test cases covering edge cases and error conditions

**Key Test Cases:**

1. **Empty PATH handling** (L66-70): Verifies `whichInPath` returns undefined when PATH is empty
2. **Exception resilience in whichInPath** (L72-109): Tests that filesystem exceptions during path resolution don't break the search algorithm - continues to next candidate after catching errors
3. **findNode execPath fallback** (L111-122): Tests fallback behavior when `process.execPath` check throws but PATH is empty - should resolve to `process.execPath` anyway
4. **findNode PATH search with exceptions** (L124-161): Tests that `findNode` continues searching PATH candidates even when some throw filesystem errors

**Platform-Specific Logic:**
- Uses `isWindows()` check (L36) to adapt test behavior
- POSIX systems: Tests multiple directories in PATH
- Windows systems: Tests multiple executable extensions (.exe, no extension) in same directory

**Dependencies:**
- `vitest` testing framework
- `@debugmcp/shared` FileSystem interfaces
- `../../src/utils/executable-resolver.js` - the module under test

**Testing Patterns:**
- Mock injection via `setDefaultFileSystem()` (L54)
- Environment restoration in afterEach (L57-64)
- Error simulation through mock functions that throw exceptions
- Platform-conditional test logic for Windows vs POSIX behavior

**Critical Invariants:**
- Mock filesystem is reset between tests
- PATH environment is restored after each test
- Exception handling doesn't prevent fallback resolution paths