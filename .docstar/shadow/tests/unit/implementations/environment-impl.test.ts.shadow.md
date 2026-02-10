# tests/unit/implementations/environment-impl.test.ts
@source-hash: 02e8f452d19311d1
@generated: 2026-02-09T18:14:39Z

## ProcessEnvironment Test Suite

**Purpose**: Unit tests for ProcessEnvironment implementation that validates environment variable handling and current working directory access.

**Test Structure**:
- Main describe block (L4-38) testing ProcessEnvironment class functionality
- afterEach cleanup (L5-8) removes test environment variables and restores mocks
- Three test cases covering core behaviors

**Test Cases**:

1. **Environment Variable Snapshot** (L10-18): Verifies ProcessEnvironment captures env vars at construction time and returns immutable snapshot, not live values. Tests that mutations to process.env after construction don't affect the captured snapshot.

2. **Defensive Copy Protection** (L20-29): Ensures getAll() returns defensive copies that cannot mutate the internal state. Validates that modifying the returned object doesn't affect subsequent calls to get() or getAll().

3. **Current Working Directory** (L31-37): Tests getCurrentWorkingDirectory() method using vi.spyOn to mock process.cwd() and verify correct delegation.

**Key Dependencies**:
- vitest testing framework (describe, it, expect, afterEach, vi)
- ProcessEnvironment from '../../../src/implementations/environment-impl.js' (L2)

**Testing Patterns**:
- Uses TEST_ENV_SNAPSHOT environment variable for isolation
- Employs vi.spyOn for mocking process.cwd()
- Cleanup pattern ensures test isolation via afterEach hook
- Tests both immutability and defensive copying behaviors

**Architecture Insights**:
- ProcessEnvironment appears to implement snapshot-based environment access
- Provides immutable view of environment variables at construction time
- Includes file system context via getCurrentWorkingDirectory method