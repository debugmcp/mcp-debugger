# Push Validation Script

## Overview

The `validate-push.js` script tests your repository in a clean clone to simulate exactly what CI will see. This helps catch issues before they reach CI/CD pipelines.

## What It Catches

- **Files that exist locally but aren't committed** (like our proxy-bootstrap.js issue)
- Build artifacts that shouldn't be committed
- Dependencies out of sync with lock files
- Tests that only pass with local state
- Missing build steps or configuration

## Usage

### Quick Commands

```bash
# Full validation (build + all tests) - most thorough
npm run validate

# Build only, no tests - fastest
npm run validate:quick

# Build + smoke tests - balanced
npm run validate:smoke
```

### Command Line Options

```bash
node scripts/validate-push.js [options]

Options:
  --no-tests    Skip running tests (faster, but less thorough)
  --smoke       Run only smoke tests instead of full suite (faster)
  --verbose     Show detailed output from commands
  --keep-temp   Don't delete the temp directory after validation
  --help        Show help message
```

## How It Works

1. **Gets current repository state** - Shows branch and commit info
2. **Creates temporary directory** - Fresh workspace for testing
