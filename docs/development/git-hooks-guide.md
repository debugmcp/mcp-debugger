# Git Hooks Guide

This project uses Husky to manage Git hooks that help maintain code quality and prevent common issues.

## Current Hook Configuration

### Pre-commit Hook (`.husky/pre-commit`)

**Purpose**: Runs before each commit to prevent personal information from being committed.

**What it does**:
- ✅ Checks for personal information in staged files (paths, usernames, etc.)
- ✅ Allows commits to proceed if no personal information is found
- ❌ Blocks commits if personal information is detected

**Developer Experience**:
- **Fast execution** - Only checks for personal information, no test running
- **WIP-friendly** - Allows work-in-progress commits with failing tests
- **Security-focused** - Prevents accidental exposure of personal data

### Pre-push Hook (`.husky/pre-push`)

**Purpose**: Runs before pushing to GitHub to ensure code quality.

**What it does**:
- 🧪 Runs the full test suite (`npm test`)
- ✅ Allows push if all tests pass
- ❌ Blocks push if any tests fail
- 💡 Provides helpful error messages and bypass instructions

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
git push origin feature-branch  # 🧪 Tests run here, push only if tests pass
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
1. Run tests locally: `npm test`
2. Fix failing tests before pushing
3. For emergencies only: `git push --no-verify`

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
