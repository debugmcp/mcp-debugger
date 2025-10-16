# Commit Workflow Guide

## Overview
This project uses Git hooks to maintain code quality. We've implemented a special workflow that **always** checks for personal information in commits while allowing you to skip time-consuming tests when needed.

## Quick Start

### Regular Commit (All Checks)
```bash
git commit -m "feat: add new feature"
# OR
npm run commit:safe -- -m "feat: add new feature"
```
Runs all checks:
- ✅ Personal information check (fast)
- ✅ Build artifact check (fast)
- 🐌 Tests and builds (can be slow)

### Fast Commit (Skip Tests Only)
```bash
npm run commit:fast -- -m "feat: add new feature"
```
Runs only:
- ✅ Personal information check (fast)
- ⚡ Skips other pre-commit checks

## Why This Exists

### The Problem
- `git commit --no-verify` skips **all** checks, including critical security checks for personal information
- Personal information (usernames, paths) should **never** be committed to the repository
- But sometimes you need to commit quickly without waiting for tests

### The Solution
We've created a safe commit wrapper that:
1. **Always** runs the personal information check (takes <1 second)
2. Optionally skips other time-consuming checks
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
- Build artifacts in source directories
- Package tarballs
- Other quick validations

#### Pre-Push Checks (Run Before Push)
- ESLint
- Build verification
- Full test suite

### Commands Reference

| Command | Personal Info Check | Other Checks | Use Case |
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
3. Pre-push hooks will still run all tests before code goes to GitHub
4. The PI check is fast (~1 second) so there's minimal overhead

## Troubleshooting

### "Command not found" Error
```bash
# Make the script executable
chmod +x scripts/safe-commit.sh
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
- ⚡ **Speed**: Skip slow tests for WIP commits
- 🛡️ **Safety Net**: CI/CD will catch issues before merge
- 🎯 **Flexibility**: Choose the right level of checking for your situation