# Git Hooks Guide

This project uses Husky to manage Git hooks that help maintain code quality and prevent common issues.

## Current Hook Configuration

These two hooks are the local half of the dev loop. [`CONTRIBUTING.md`](../../CONTRIBUTING.md) carries the
canonical description of the whole loop (what runs locally, and what CI adds on
top); this page just documents the hooks themselves.

### Pre-commit Hook (`.husky/pre-commit`)

**Purpose**: Runs before each commit to keep personal data and build artifacts out of the repository. It runs **no tests and no build**.

**What it does**:
- ✅ Personal information check over staged files (`scripts/check-personal-paths.cjs`)
- ✅ Blocks staged build artifacts — `.js`, `.d.ts`, `.js.map` under `src/` or `packages/*/src/`; the one exception is `src/proxy/proxy-bootstrap.js`, which is a legitimate JavaScript source file
- ✅ Blocks staged `.tgz` package tarballs (local-testing artifacts)
- ✅ Runs `docstar check` if — and only if — `docstar` is on your PATH; its result never blocks the commit

**Developer Experience**:
- **Fast execution** - A few scans of the staged file list; no tests, no compilation
- **WIP-friendly** - Allows work-in-progress commits with failing tests
- **Security-focused** - Prevents accidental exposure of personal data

### Pre-push Hook (`.husky/pre-push`)

**Purpose**: Runs before pushing to GitHub to ensure code quality.

**What it does**, in order, stopping at the first failure:

1. `pnpm run lint` (ESLint)
2. Refuses the push if `tests/typecheck-baseline.json` is modified but not committed — the ratchet check in CI reads the pushed commit, not your working tree
3. `pnpm run typecheck:all` (source typecheck + the test ratchet)
4. `npm run clean && npm run build` — a clean build, and the authoritative compile
5. `npm run test:unit && npm run test:integration`

**It does not run the full test suite.** The heavy e2e set (smoke, Docker, npx) runs in CI only. A tag-only push takes a different branch and runs the reduced `npm run test:ci-no-python` in place of step 5.

Docker-dependent tests are skipped automatically when `docker buildx version` fails — the hook exports `SKIP_DOCKER_TESTS=true`. As on pre-commit, the `docstar` steps run only if that binary is installed and never block the push.

**Developer Experience**:
- **Quality gate** - Ensures only working code reaches GitHub
- **Flexible development** - Local commits can have failing tests
- **Emergency bypass** - Use `git push --no-verify` for urgent pushes

## Workflow Benefits

### For Daily Development
1. **Make incremental commits** - Tests don't run on commit, so you can save progress frequently
2. **Personal info protection** - Automatic scanning prevents accidental exposure
3. **Quality assurance** - Tests run before sharing code with the team

### For Refactoring Projects
- **Perfect for WIP commits** during large refactoring efforts
- **Safe experimentation** - Commit often without test pressure
- **Clean GitHub history** - Only working code gets pushed

## Usage Examples

### Normal Development Flow
```bash
# Make changes
git add .
git commit -m "WIP: refactoring session manager"  # ✅ Fast commit, only personal info check

# Continue working...
git add .
git commit -m "WIP: add type safety improvements"  # ✅ Another fast commit

# Ready to share
git push origin feature-branch  # 🧪 Lint, typecheck, clean build, unit + integration tests run here
```

### Emergency Situations
```bash
# If you need to push despite failing tests (use sparingly!)
git push --no-verify origin hotfix-branch
```

### Personal Information Detection
```bash
# If personal info is detected:
git commit -m "Add new feature"
# ❌ ERROR: Personal information found in staged files!
# 📄 src/config.ts
#    Pattern: personal path detected
#    Found: personal path in file

# Fix the issue and try again
git add .
git commit -m "Add new feature"  # ✅ Success after fixing
```

## Hook Management

### Bypassing Hooks (Emergency Use Only)
```bash
# Skip pre-commit hook
git commit --no-verify -m "Emergency commit"

# Skip pre-push hook  
git push --no-verify origin branch-name
```

### Reinstalling Hooks
```bash
# If hooks stop working
npm run prepare
```

### Checking Hook Status
```bash
# Verify hooks are installed
ls -la .husky/
# Should show: pre-commit, pre-push (both executable)
```

## Troubleshooting

### Hook Not Running
1. Check if Husky is installed: `npm run prepare`
2. Verify hook files exist and are executable
3. Ensure you're in the project root directory

### Tests Failing on Push
1. Reproduce the gate locally: `pnpm run test:unit && pnpm run test:integration`
2. Fix failing tests before pushing
3. For emergencies only: `git push --no-verify`

### Lint or Typecheck Failing on Push
1. `pnpm run lint` (or `pnpm run lint:fix`) for style and syntax errors
2. `pnpm run typecheck:all` for type errors
3. If a test file's recorded error count changed on purpose, run `pnpm run typecheck:tests:update` and **commit** `tests/typecheck-baseline.json` — an uncommitted baseline is itself a push blocker

### Personal Information False Positives
1. Check the detected pattern in the error message
2. Update `scripts/check-personal-paths.cjs` if needed
3. Use generic paths like `/path/to/project` instead of specific user paths

## Configuration Files

- **Hook definitions**: `.husky/pre-commit`, `.husky/pre-push`
- **Personal info checker**: `scripts/check-personal-paths.cjs`
- **Husky setup**: `package.json` (prepare script)

## Best Practices

### ✅ Do
- Commit frequently during development
- Use descriptive commit messages
- Fix tests before pushing to shared branches
- Keep personal information out of code

### ❌ Don't
- Use `--no-verify` routinely (only for emergencies)
- Commit personal paths or sensitive information
- Push broken code to main/develop branches
- Disable hooks permanently

## Migration Notes

**Previous Setup**: Tests ran on every commit, blocking WIP commits
**New Setup**: Tests only run on push, allowing flexible local development

This change improves developer experience during refactoring and feature development while maintaining code quality standards for shared code.
