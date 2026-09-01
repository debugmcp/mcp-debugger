# Vitest Output Optimization for LLM Development

## Overview

When working with LLMs on development tasks, test output can consume significant tokens due to verbose progress indicators and passing test details. This document describes the optimization implemented in `scripts/llm-env.ps1` that sharply reduces test output while preserving all critical debugging information.

> **Windows / PowerShell only.** `scripts/llm-env.ps1` is the sole implementation — there is
> no shell equivalent in this repo. On Linux/macOS (and in CI) use the npm scripts documented
> in [vitest-llm-config.md](./vitest-llm-config.md) instead.

## Problem

Standard `npm test` output includes:
- Dynamic progress updates that create duplicate lines when captured
- Details for every passing test
- Verbose formatting with Unicode symbols
- Intermediate summary lines

Example of problematic output captured by LLM:
```
❯ tests/e2e/debugpy-connection.test.ts 0/2
Test Files 1 failed | 0 passed (48)
Tests 2 failed | 0 passed (4)
Duration 1.89s

❯ tests/e2e/debugpy-connection.test.ts 0/2
Test Files 1 failed | 0 passed (48)
Tests 2 failed | 0 passed (4)
Duration 2.96s
```

## Solution

The script uses TAP (Test Anything Protocol) reporter with intelligent filtering:

### Why TAP?
- **35+ year stable format** - Rarely changes between versions
- **Simple patterns** - Easy to parse reliably
- **No progress updates** - Designed for CI/non-interactive use
- **Structured output** - Clear separation of test results

### Implementation

```powershell
# Force CI mode to prevent dynamic updates
$env:CI = 'true'

# Plain npm test is rewritten to:
npm.cmd run test:coverage -- --reporter=tap

# Filter to show only:
# - TAP header (version, test count)
# - Failed test files and their details
# - Coverage report
# - Skip all passing test output
```

### Caveat: the rewrite changes the gate, not just the output

Plain `npm test` is rewritten to `npm.cmd run test:coverage -- --reporter=tap`, and those are
not the same check:

- `test:coverage` is `vitest run --coverage`, and `vitest.config.ts` **enforces** coverage
  thresholds (90% statements, 80% branches). A run in which every test passes can therefore
  still exit non-zero under the wrapper, where plain `npm test` — which does not collect
  coverage — would have passed. If the wrapper fails with a threshold error rather than a test
  failure, that is why.
- `test:coverage` also carries a `pretest:coverage` step (build → Docker image check → clear
  the previous coverage output), so the wrapped run does more work than the one it replaces.

The `npm test:unit` / `npm test:int` / `npm test:e2e` wrappers append `--coverage` as well, so
the same threshold gate applies to those partial runs — and a partial run measures coverage
over only the files that subset touches.

Use `npm.cmd test` to bypass the rewrite and run the unwrapped command.

## Usage

```powershell
# Source the optimization script
. ./scripts/llm-env.ps1

# All npm commands work naturally - no need to remember npm.cmd
npm run build      # Works perfectly (pass-through)
npm install        # Works perfectly (pass-through)
npm test           # Automatically optimized: plain `npm test` is rewritten to
                   # `npm.cmd run test:coverage -- --reporter=tap`
                   # (targeted `npm test <args>` with extra args are forwarded directly)
                   # NOTE: that rewrite enables coverage, whose thresholds are enforced —
                   # see the caveat above.
npm test:unit      # Optimized unit tests
npm test:int       # Alias for test:integration (runs npm.cmd run test:integration -- --coverage --reporter=tap)
npm test:e2e       # Optimized e2e tests

# Original commands still available if needed
npm.cmd test       # Bypass optimization
```

## Results

The figures below come from the original measurement taken when the script was introduced;
they have not been re-measured since.

### Before Optimization
- ~15,000+ characters of output
- Hundreds of duplicate progress lines
- Details for every passing test (the `unit` project alone currently matches ~257 test files)

### After Optimization
- ~1,500 characters for same test run
- Only failed tests with full stack traces
- Complete coverage report maintained
- **~90% reduction in token usage**

### Example Optimized Output
```
TAP version 13
1..48
not ok 5 - tests/adapters/python/integration/python_debug_workflow.test.ts # time=731.82ms {
    1..1
    not ok 1 - Python Debugging Workflow - Integration Test # time=731.22ms {
        1..2
        not ok 1 - should complete a full debug session # time=239.87ms
            ---
            error:
                name: "AssertionError"
                message: "expected false to be true"
            at: "tests/adapters/python/integration/python_debug_workflow.test.ts:150:33"
            actual: "false"
            expected: "true"
            ...
    }
}
% Coverage report from istanbul
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   90.39 |    84.81 |   91.83 |   90.55 |
...
```

## Technical Details

### TAP Filtering Logic

**Note:** There is exactly one TAP filtering implementation: `scripts/llm-env.ps1` (PowerShell, for Windows dev use). There is no Bash counterpart — CI and non-Windows machines rely on the npm scripts in [vitest-llm-config.md](./vitest-llm-config.md) instead.

1. Always show TAP header and test plan
2. Track nested test structure with depth counter
3. When `ok X - file.ts` seen → skip entire block
4. When `not ok X - file.ts` seen → show entire block
5. Comment lines (prefixed with `#`) are always shown (e.g., TAP diagnostics, bail-out messages)
6. Always show coverage report at end

### Key Regex Patterns
- Failed test file: `^not ok \d+ - .*\.ts`
- Passing test file: `^ok \d+ - .*\.ts`
- Coverage lines: Multiple patterns to catch all report lines

## Benefits

1. **Token Efficiency**: a large reduction in LLM token usage (~90% in the original measurement -- see the caveat under Results)
2. **Debugging Focus**: Only see what needs attention
3. **Coverage Tracking**: Keeps the coverage report visible, including the enforced thresholds (90% statements / 80% branches)
4. **Stable Format**: TAP's stability reduces maintenance
5. **Zero Config**: Works automatically when script is sourced

## Docker Build Optimization

The script also optimizes Docker build output to prevent duplicate progress lines:

### Problem
Docker's default BuildKit output creates dynamic progress updates that result in hundreds of duplicate lines when captured by LLMs:
```
[+] Building 0.2s (1/3)
[+] Building 0.3s (1/3)
[+] Building 0.4s (1/3)
... (hundreds of duplicates)
```

### Solution
The script automatically adds `--progress=plain` to all `docker build` commands, only when no `--progress` flag is already supplied:
```powershell
docker build -t myimage .
# Automatically becomes:
docker build --progress=plain -t myimage .
```

This provides clean, linear output without duplicates while preserving all build information.

## Future Improvements

- Could add filtering for specific test name patterns
- Consider caching coverage data between runs
- Explore other stable formats (JUnit XML, etc.)
- Add more command optimizations (git operations, etc.)
