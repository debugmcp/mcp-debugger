# scripts/llm-env.ps1
@source-hash: ca2203699fb9b652
@generated: 2026-02-10T00:42:01Z

## Purpose
PowerShell environment script that optimizes command-line tool output for LLM/AI agent consumption by suppressing verbose passing test output while preserving failure details and coverage information.

## Architecture
The script overrides common development commands (`npm`, `docker`, `git-clone`) with wrapper functions that modify their output behavior for token efficiency.

## Key Functions

### npm Override (L16-147)
- **Core Logic**: Intercepts npm test commands and filters TAP output to show only failures
- **Test Detection**: Pattern matches against `'^(run )?test(\s|$)'` to identify test commands
- **Filtering Strategy**: 
  - Shows TAP headers, test plans, and coverage reports
  - Suppresses passing test output using state tracking (`$inFailure`, `$skipDepth`)
  - Preserves full failure details with nested content
- **Test Variants**: Handles `test:unit` (L95-110), `test:int` (L111-126), `test:e2e` (L127-142) with similar filtering
- **Specific Tests**: When test files are specified, passes through without filtering (L42-46)

### docker Override (L150-172)
- **Purpose**: Adds `--progress=plain` to build commands to prevent duplicate output lines
- **Logic**: Injects progress flag unless already specified

### git-clone Helper (L174-177)
- **Purpose**: Wraps git clone with `--quiet` flag

### Show-LLMHelpers (L180-189)
- **Purpose**: Documentation function displaying available overrides and usage

## Key Patterns
- **State Machine**: Uses boolean flags (`$inFailure`) and counters (`$skipDepth`) for TAP output parsing
- **Pattern Matching**: Extensive regex matching for command detection and output filtering
- **Argument Preservation**: Maintains original argument arrays while creating string versions for pattern matching
- **CI Mode**: Sets `$env:CI = 'true'` to prevent dynamic terminal updates

## Dependencies
- Requires `npm.cmd`, `docker.exe`, `git.exe` as fallbacks for original functionality
- Assumes TAP test reporter availability
- Expects specific npm script targets (`test:coverage`, `test:unit`, `test:integration`, `test:e2e`)

## Critical Invariants
- Original commands remain accessible via `.cmd`/`.exe` suffixes
- State tracking must be reset between test files to prevent output corruption
- Regex patterns must accurately distinguish between passing/failing tests to avoid information loss