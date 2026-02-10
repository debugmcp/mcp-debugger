# scripts/validate-push.js
@source-hash: 6942bc4bfd94564c
@generated: 2026-02-09T18:15:15Z

## Purpose
CLI validation script that simulates CI environment by testing code in a clean repository clone. Designed to catch pre-push issues like missing committed files, build failures, and tests that only pass with local state.

## Core Architecture
**Main Flow**: `validatePush()` function (L48-200) orchestrates a 7-step validation process:
1. Get git state (branch, commit, uncommitted changes)
2. Create temp directory 
3. Clone repository to simulate CI
4. Checkout specific commit
5. Install dependencies (`pnpm install`)
6. Build project (`pnpm build`)
7. Run tests (full suite or smoke tests)

## Key Functions
- `log(message, color)` (L21-23): Colored console output utility
- `exec(command, cwd)` (L25-35): Executes commands with captured output, throws on failure
- `execWithOutput(command, cwd)` (L37-46): Executes commands with inherited stdio for verbose mode
- `validatePush(options)` (L48-200): Main validation orchestrator with cleanup handling
- `main()` (L203-250): CLI argument parser and entry point

## Configuration Options
Supports runtime configuration via options object (L54-59):
- `runTests`: Enable/disable test execution (default: true)
- `runSmoke`: Run subset of tests instead of full suite (default: false)
- `verbose`: Show detailed command output (default: false) 
- `keepTemp`: Preserve temp directory for debugging (default: false)

## CLI Interface
Arguments parsed in `main()` (L207-213):
- `--no-tests`: Skip test execution
- `--smoke`: Run only smoke tests (specific test files at L134)
- `--verbose/-v`: Enable verbose output
- `--keep-temp`: Preserve temp directory
- `--help/-h`: Show usage information

## Dependencies
- `child_process.execSync`: Command execution
- `fs-extra`: File system operations with async support
- `path`, `os`: Path manipulation and temp directory creation

## Error Handling
- Comprehensive try/catch with cleanup in finally block (L184-199)
- Warns about uncommitted changes that won't be tested (L74-85)
- Provides common failure causes on validation failure (L171-175)
- Graceful cleanup even on errors

## Critical Behaviors
- Always restores original working directory (L186)
- Creates unique temp directories using timestamp (L51)
- Uses `--no-local` git clone to ensure clean state (L94)
- Exits with appropriate status codes (0 for success, 1 for failure)