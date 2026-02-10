# scripts/safe-commit.sh
@source-hash: d9faecfd3ba2d9a8
@generated: 2026-02-09T18:15:12Z

## Purpose
Bash wrapper script that enforces mandatory personal information checks before git commits while providing optional bypass for other verification steps.

## Core Functionality

### Mandatory Personal Information Check (L5-16)
- **Always executes** `node scripts/check-personal-paths.cjs` regardless of flags
- Hard fails with exit code 1 if personal info detected (L8-16)
- Cannot be bypassed for security compliance
- Provides helpful error messages with fix suggestions (L13-14)

### Conditional Commit Logic (L21-30)
- **Skip Mode** (L21-26): Triggered by `--skip-tests` flag OR `SKIP_TESTS=true` env var
  - Uses `git commit --no-verify` to bypass pre-commit hooks
  - Removes `--skip-tests` from args before passing to git (L25)
- **Normal Mode** (L28-29): Standard `git commit` with all hooks enabled

## Key Dependencies
- Node.js script: `scripts/check-personal-paths.cjs` (L6)
- Git CLI for commit operations (L26, L29)

## Architecture Patterns
- **Security-first design**: Unskippable personal info validation
- **Flexible workflow support**: Optional test/hook bypass for rapid iteration
- **Parameter passthrough**: Preserves all git commit arguments except `--skip-tests`

## Usage Patterns
- Standard commit: `./safe-commit.sh -m "message"`
- Quick commit: `./safe-commit.sh --skip-tests -m "message"`
- Environment bypass: `SKIP_TESTS=true ./safe-commit.sh -m "message"`

## Critical Constraints
- Personal information check always runs first and cannot be disabled
- Script exit codes propagate to calling process
- `--skip-tests` flag consumption affects downstream argument parsing