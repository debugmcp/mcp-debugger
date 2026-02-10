# scripts/validate-push.js
@source-hash: 6942bc4bfd94564c
@generated: 2026-02-10T00:42:07Z

## Push Validation Script

A pre-push validation script that simulates CI environment by testing code in a clean repository clone. Primary purpose is to catch integration issues before they reach CI by replicating the exact conditions CI will encounter.

### Core Components

**Main Validation Function** `validatePush(options)` (L48-200)
- Creates temporary directory with timestamp-based naming
- Clones current repository to simulate fresh CI checkout  
- Runs full validation pipeline: clone → checkout → install → build → test
- Returns boolean success/failure status
- Handles cleanup with configurable temp directory preservation

**Command Execution Utilities**
- `exec(command, cwd)` (L25-35): Silent execution with UTF-8 output capture
- `execWithOutput(command, cwd)` (L37-46): Execution with inherited stdio for verbose mode
- Both throw descriptive errors on command failure

**CLI Interface** `main()` (L203-250)
- Argument parsing for flags: `--no-tests`, `--smoke`, `--verbose`, `--keep-temp`, `--help`
- Help text with usage examples and option descriptions (L216-240)
- Exit code handling: 0 for success, 1 for failure/error

**Utility Functions**
- `log(message, color)` (L21-23): Colored console output with ANSI escape codes
- Color constants object (L12-19): Terminal color definitions

### Validation Pipeline

1. **Repository State Analysis** (L66-85): Checks current branch, commit hash, and uncommitted changes with warnings
2. **Clean Environment Setup** (L87-101): Creates temp directory and clones repository with `--no-local` flag
3. **Commit Checkout** (L107-109): Ensures exact commit state that would be seen in CI
4. **Dependency Installation** (L112-118): Runs `pnpm install` in clean environment
5. **Build Process** (L121-127): Executes `pnpm build` to verify compilation
6. **Test Execution** (L130-154): Configurable test running with smoke test option for speed

### Configuration Options

Default configuration with override capability:
- `runTests`: true (can disable with `--no-tests`)
- `runSmoke`: false (enable with `--smoke` for faster subset testing)  
- `verbose`: false (enable with `--verbose` for command output)
- `keepTemp`: false (enable with `--keep-temp` for debugging)

### Dependencies

- `child_process.execSync`: Command execution
- `fs-extra`: Enhanced file system operations with async support
- `path`: Path manipulation utilities  
- `os`: Operating system utilities for temp directory access

### Error Handling

Comprehensive error handling with user-friendly messages:
- Command failures include original command and error details
- Common failure scenarios documented in error output (L171-175)
- Cleanup guaranteed via try/finally block with fallback error handling
- Process exit codes properly set for CI integration

### Architecture Notes

- Designed for pnpm-based projects (hardcoded pnpm commands)
- Uses git operations extensively, requires git repository context
- Smoke tests target specific test files: `tests/unit/index.test.ts` and `tests/core/unit/server/server.test.ts` (L134)
- Module can be imported (`module.exports`) or run directly via CLI detection (L253-254)