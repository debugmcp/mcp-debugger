# tests/unit/implementations/environment-impl.test.ts
@source-hash: 02e8f452d19311d1
@generated: 2026-02-10T00:41:29Z

## ProcessEnvironment Test Suite

**Primary Purpose:** Unit tests for the `ProcessEnvironment` class implementation, validating environment variable snapshot behavior, immutability guarantees, and current working directory access.

**Test Structure:**
- Main test suite: `ProcessEnvironment` (L4-38)
- Cleanup hook: `afterEach` (L5-8) - removes test env vars and restores mocks
- Three core test cases covering distinct functionality areas

**Key Test Cases:**

1. **Snapshot Immutability Test** (L10-18)
   - Verifies environment variables are captured at construction time
   - Tests that subsequent `process.env` mutations don't affect the snapshot
   - Uses `TEST_ENV_SNAPSHOT` as test variable

2. **Defensive Copy Test** (L20-29) 
   - Validates that `getAll()` returns a defensive copy
   - Ensures mutations to returned object don't affect internal state
   - Tests both `get()` and `getAll()` methods for consistency

3. **Current Working Directory Test** (L31-37)
   - Mocks `process.cwd()` using Vitest spy functionality
   - Verifies `getCurrentWorkingDirectory()` delegates to `process.cwd()`

**Dependencies:**
- Vitest testing framework (`describe`, `it`, `expect`, `afterEach`, `vi`)
- `ProcessEnvironment` from `../../../src/implementations/environment-impl.js`

**Testing Patterns:**
- Uses `afterEach` for consistent test cleanup
- Employs Vitest mocking (`vi.spyOn`, `vi.restoreAllMocks`) for process isolation
- Tests both positive behavior and immutability guarantees