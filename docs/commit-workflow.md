# Commit Workflow Guide

## Overview
This project uses Git hooks to maintain code quality. We've implemented a special workflow that **always** checks for personal information in commits while allowing you to skip the remaining pre-commit checks when needed. For the full dev loop — what runs on commit, on push, and in CI — see [`CONTRIBUTING.md`](../CONTRIBUTING.md) and the [Git Hooks Guide](./development/git-hooks-guide.md).

## Quick Start

### Regular Commit (All Checks)
```bash
git commit -m "feat: add new feature"
# OR
npm run commit:safe -- -m "feat: add new feature"
```
Runs every pre-commit check — all of them fast:
- ✅ Personal information check
- ✅ Build artifact check (staged `.js` / `.d.ts` / `.js.map` under `src/` or `packages/*/src/`)
- ✅ Package tarball (`.tgz`) check

The pre-commit hook runs **no tests and no build**. The slow gates — lint, typecheck, a clean build, and the unit + integration suites — all live in the pre-push hook.

### Fast Commit (Skip Git Hooks)
```bash
npm run commit:fast -- -m "feat: add new feature"
```
Manually runs the personal information check first, then uses `git commit --no-verify` internally, which bypasses **all** Git hooks (pre-commit, commit-msg, etc.):
- ✅ Personal information check runs FIRST (fast)
- ⚡ Then commits with `--no-verify`, skipping the rest of the pre-commit hook (build-artifact and tarball checks) and any other hook that would fire on commit

The flag is spelled `--skip-tests` for historical reasons; no tests run on commit either way.

## Why This Exists

### The Problem
- `git commit --no-verify` skips **all** checks, including critical security checks for personal information
- Personal information (usernames, paths) should **never** be committed to the repository
- But sometimes you need to commit quickly without waiting for the rest of the checks

### The Solution
We've created a safe commit wrapper that:
1. **Always** runs the personal information check (takes <1 second)
2. Optionally skips the other pre-commit checks
3. Prevents accidental exposure of personal data

## Detailed Workflow

### What Gets Checked

#### Personal Information Check (Always Runs)
Detects and blocks:
- Personal usernames in paths (matches patterns like `/Users/[name]/` or `C:\Users\[name]\`)
- Cloud storage paths (Dropbox, OneDrive, Google Drive, etc.)
- Dated project folders (patterns with dates and project codes)
- Personal folder patterns (Documents, Desktop, Downloads with personal content)

#### Pre-Commit Checks (Can Be Skipped)
- Build artifacts staged under `src/` or `packages/*/src/` — `.js`, `.d.ts`, `.js.map` (`src/proxy/proxy-bootstrap.js` is exempt; it is a real source file)
- Package tarballs (`.tgz`)
- `docstar check`, and only if that binary is installed — advisory, never blocking

#### Pre-Push Checks (Run Before Push)
In order, stopping at the first failure:
1. `pnpm run lint`
2. A guard that `tests/typecheck-baseline.json` is not modified-but-uncommitted
3. `pnpm run typecheck:all`
4. `npm run clean && npm run build`
5. `npm run test:unit && npm run test:integration` — **not** the full suite; the e2e set runs in CI

### Commands Reference

| Command | Personal Info Check | Other Pre-Commit Checks | Use Case |
|---------|-------------------|--------------|----------|
| `git commit` | ✅ | ✅ | Normal development |
| `npm run commit:safe` | ✅ | ✅ | Same as git commit |
| `npm run commit:fast` | ✅ | ❌ | Quick commits |
| `git commit --no-verify` | ❌ | ❌ | Emergency only! |

## Examples

### Example 1: Regular Development
```bash
# Make changes
git add .
git commit -m "fix: resolve connection issue"
# All checks run
```

### Example 2: Quick WIP Commit
```bash
# Make changes
git add .
npm run commit:fast -- -m "WIP: debugging connection"
# Only personal info check runs
```

### Example 3: If Personal Info Is Detected
```bash
$ npm run commit:fast -- -m "add test results"
🔍 Running mandatory personal information check...

❌ Personal information found in staged files!

📄 test-results.md
   Pattern detected: Personal username in file path

📝 Please replace with generic paths like:
   - /path/to/project
   - ~/workspace/project
   - C:\path\to\project

# Fix the file and try again
```

## Setting Up Git Aliases (Optional)

Add these to your `.gitconfig` for even faster access:

```bash
# Add to ~/.gitconfig
[alias]
    cs = !npm run commit:safe --
    cf = !npm run commit:fast --

# Usage
git cs -m "feat: add feature"  # Safe commit
git cf -m "WIP: quick fix"      # Fast commit (PI check only)
```

## Important Notes

1. **Personal information checks cannot be bypassed** with our safe commit commands
2. Use `git commit --no-verify` only in absolute emergencies
3. Pre-push hooks still run lint, typecheck, a clean build, and the unit + integration suites before code goes to GitHub (e2e runs in CI)
4. The PI check is fast (~1 second) so there's minimal overhead

## Troubleshooting

### "Command not found" Error
```bash
# Make the script executable (only needed if invoking directly)
chmod +x scripts/safe-commit.sh
# The script skips the remaining pre-commit checks when its first argument is
# --skip-tests, or when SKIP_TESTS=true is set in the environment. All other
# args are forwarded to git.
```

### Personal Info Check Keeps Failing
- Check the patterns in `scripts/check-personal-paths.cjs`
- Replace personal paths with generic ones:
  - Bad: Paths containing actual usernames or personal folders
  - Good: `/path/to/project`
  - Good: `~/workspace/mcp-debugger`
  - Good: `./relative/path`

### Need to Bypass Everything (Emergency Only!)
```bash
# This skips ALL checks - use with extreme caution!
git commit --no-verify -m "emergency: critical fix"
```

## Benefits

- 🔒 **Security**: Personal information never accidentally committed
- ⚡ **Speed**: Skip the remaining pre-commit checks for WIP commits
- 🛡️ **Safety Net**: CI/CD will catch issues before merge
- 🎯 **Flexibility**: Choose the right level of checking for your situation