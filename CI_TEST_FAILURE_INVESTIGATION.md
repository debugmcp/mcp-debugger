# CI Test Failure Investigation Prompt

## Context
The mcp-debugger project has 1019 tests total, but the CI workflow excludes e2e and Python tests to maintain a green build. When running the FULL test suite in the CI environment (using Act), we found that 1014 tests pass and only 4 tests actually fail. This means we're unnecessarily excluding 83+ passing tests from CI.

## The 4 Failing Tests

### 1. Full Debug Session - Multiple Breakpoints Test
**File**: `tests/e2e/full-debug-session.test.ts`
**Test**: "python debugging > should handle multiple breakpoints correctly"
**Error**: Timeout waiting for session to reach paused/stopped state
**Pattern**: `[EventUtils] Timeout waiting for session ... to reach any of: paused, stopped. Current state: 'running'. Waited 10000ms`

### 2. Container Smoke Test - Path Handling
**File**: `tests/e2e/mcp-server-smoke-container.test.ts`
**Test**: "should handle paths naturally in container mode"
**Error**: Docker cleanup error: `docker rm mcp-path-test-...`
**Pattern**: Docker container management issue

### 3-4. SSE Transport Tests (2 failures)
**File**: `tests/e2e/mcp-server-smoke-sse.test.ts`
**Tests**:
- "should successfully debug fibonacci.py via SSE transport"
- "should work when SSE server is spawned from different working directory"
**Error**: `SSE server exited with code null`
**Pattern**: Server process management in CI environment

## Investigation Questions

### For Each Failing Test:

#### 1. What is the test actually testing?
- What feature/capability is being validated?
- Is this a critical path or edge case?
- What would break if this test were removed?

#### 2. Why does it fail in CI but pass locally?
- **Docker-in-Docker issues?** (Act runs in Docker, tests spawn Docker containers)
- **Process management differences?** (SSE server lifecycle)
- **Timing/performance issues?** (10s timeout might be too short in CI)
- **Network/port binding differences?** (localhost vs container networking)
- **File system differences?** (volume mounts, permissions)

#### 3. What type of failure is this?

**Category A: Test Design Issue**
- Test assumes local environment characteristics
- Hardcoded timeouts too aggressive for CI
- Test cleanup not robust enough
- Should be modified to work in CI

**Category B: Implementation Bug**
- Our code doesn't handle CI environment correctly
- Missing error handling for edge cases
- Race conditions exposed by slower CI environment
- Implementation should be fixed

**Category C: Inappropriate for CI**
- Requires resources not available in CI (like Docker-in-Docker)
- Tests interactive/GUI features
- Tests platform-specific behavior
- Should be skipped in CI with proper justification

## Specific Investigation Tasks

### Task 1: Analyze Multiple Breakpoints Test
```bash
# Look at the test implementation
cat tests/e2e/full-debug-session.test.ts | grep -A 50 "should handle multiple breakpoints"

# Check timeout configuration
grep -r "10000" tests/e2e/full-debug-session.test.ts

# See if there's retry logic
grep -r "retry\|attempt\|waitFor" tests/e2e/full-debug-session.test.ts
```

**Questions**:
- Is 10 seconds enough time for Python/debugpy to initialize in a containerized CI environment?
- Does the test properly wait for debugpy to be ready before setting breakpoints?
- Could this be a race condition where breakpoints are set before the debugger is attached?

### Task 2: Analyze Container Path Test
```bash
# Look at container management
grep -B5 -A10 "handle paths naturally" tests/e2e/mcp-server-smoke-container.test.ts

# Check Docker cleanup logic
grep -r "docker rm\|cleanup\|teardown" tests/e2e/

# Look for Docker-in-Docker configuration
grep -r "DOCKER_HOST\|docker.sock" tests/
```

**Questions**:
- Is the test trying to use Docker-in-Docker?
- Are container names conflicting in parallel test runs?
- Is cleanup happening in the wrong order?

### Task 3: Analyze SSE Server Tests
```bash
# Check SSE server spawn logic
grep -B10 -A10 "SSE server exited" tests/e2e/mcp-server-smoke-sse.test.ts

# Look at server lifecycle management
grep -r "spawn\|fork\|exec" tests/e2e/mcp-server-smoke-sse.test.ts

# Check port management
grep -r "PORT\|port\|3000\|listen" tests/e2e/mcp-server-smoke-sse.test.ts
```

**Questions**:
- Is the SSE server failing to start due to port conflicts?
- Are we properly waiting for the server to be ready?
- Is there a missing dependency in the CI environment?

## Decision Matrix

For each failing test, classify and decide:

| Test | Category | Action | Justification |
|------|----------|--------|---------------|
| Multiple breakpoints | A/B/C? | Fix test/Fix impl/Skip | Why? |
| Container paths | A/B/C? | Fix test/Fix impl/Skip | Why? |
| SSE transport 1 | A/B/C? | Fix test/Fix impl/Skip | Why? |
| SSE transport 2 | A/B/C? | Fix test/Fix impl/Skip | Why? |

## Recommended Actions

### If Category A (Test Issue):
1. Increase timeouts for CI environment
2. Add retry logic with exponential backoff
3. Improve test isolation and cleanup
4. Add CI-specific test configuration

### If Category B (Implementation Issue):
1. Fix the actual bug in the implementation
2. Add proper error handling
3. Make code more resilient to different environments
4. Add logging to help diagnose future issues

### If Category C (Inappropriate for CI):
1. Skip with clear justification
2. Document what manual testing is required
3. Consider alternative test approaches
4. Add to release checklist for manual verification

## Success Criteria

The goal is to:
1. **Enable maximum test coverage in CI** - Run as many of the 1019 tests as possible
2. **Document clear rationale** - For any test we skip, explain WHY
3. **Improve reliability** - Tests should pass consistently, not flakily
4. **Maintain feature coverage** - Don't lose important validations

## Next Steps

1. Run each failing test in isolation in Act environment
2. Add debug logging to understand exact failure points
3. Try fixes in order of impact (easiest first)
4. Create PR with either:
   - Fixed tests that now pass in CI
   - Fixed implementation that handles CI properly
   - Properly skipped tests with clear skip conditions

## Example Skip Pattern

```typescript
describe.skipIf(process.env.CI && !process.env.DOCKER_HOST)(
  'Docker-in-Docker tests',
  () => {
    // Tests that require Docker-in-Docker capability
    test('should handle container paths', () => {
      // This test requires Docker daemon access from within Act container
      // Skipped in CI unless DOCKER_HOST is configured for Docker-in-Docker
    });
  }
);
```

## Investigation Commands

```bash
# Run just the failing tests in Act
act -W test-full-ci.yml -j test-all --env TEST_FILTER="full-debug-session"

# Run with verbose logging
act -W test-full-ci.yml -j test-all --env DEBUG="*" --env LOG_LEVEL="debug"

# Check Docker-in-Docker setup
act -W test-full-ci.yml -j test-all --privileged --container-options "-v /var/run/docker.sock:/var/run/docker.sock"

# Test with extended timeouts
act -W test-full-ci.yml -j test-all --env TEST_TIMEOUT_MULTIPLIER=3
```

## Final Questions to Answer

1. **Are we testing the right things?** - Do these e2e tests provide value or are they redundant?
2. **Can we make tests more resilient?** - Add retries, better waits, smarter assertions?
3. **Should CI mirror production?** - Or is it OK to have some differences?
4. **What's the maintenance cost?** - Of fixing vs skipping vs leaving excluded?

---

This investigation should determine whether each failing test represents:
- A test that needs fixing to work in CI
- A bug in our implementation that CI exposed
- A legitimate reason to skip in CI (like platform-specific tests)