# scripts/safe-commit.sh
@source-hash: d9faecfd3ba2d9a8
@generated: 2026-02-10T00:41:58Z

## Purpose
Bash wrapper script that enforces mandatory personal information checks before Git commits while providing optional bypass for other verification steps.

## Key Components

### Personal Information Check (L5-16)
- **Mandatory Security Gate**: Always executes `node scripts/check-personal-paths.cjs` (L6)
- **Non-bypassable**: Exits with code 1 if check fails (L8-16)
- **User Guidance**: Provides specific remediation examples (L13-14)

### Conditional Commit Logic (L21-30)
- **Skip Mode**: Activates via `--skip-tests` flag or `SKIP_TESTS` env var (L21)
- **Bypass Mechanism**: Uses `git commit --no-verify` to skip pre-commit hooks (L26)
- **Argument Handling**: Removes `--skip-tests` flag before passing args to git (L25)
- **Normal Mode**: Standard `git commit` with all hooks enabled (L29)

## Dependencies
- **External Script**: `scripts/check-personal-paths.cjs` - Node.js script for path validation
- **Git**: Standard git commit functionality
- **Shell Environment**: Bash shell with standard utilities

## Architectural Decisions
- **Two-tier Security**: Separates mandatory security checks from optional development checks
- **Environment Override**: Supports both CLI flag and environment variable control
- **Fail-fast Pattern**: Exits immediately on security violations
- **Hook Bypass**: Leverages git's `--no-verify` for selective hook skipping

## Critical Invariants
- Personal information check ALWAYS runs regardless of skip flags
- Exit code 1 terminates entire commit process on security failure
- Script maintains original git commit argument semantics