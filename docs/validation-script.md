# Push Validation Script

Validates your changes in a clean clone to simulate exactly what CI will see.

## Usage

```bash
npm run validate         # Full validation (build + all tests)
npm run validate:quick   # Build only, no tests
npm run validate:smoke   # Build + smoke tests
```

Or run directly:

```bash
node scripts/validate-push.js [options]
```

## Command Line Options

| Flag | Short | Description |
|------|-------|-------------|
| `--no-tests` | | Skip running tests |
| `--smoke` | | Run only smoke tests instead of the full suite |
| `--verbose` | `-v` | Show detailed output from all commands |
| `--keep-temp` | | Preserve the temp directory after validation (useful for debugging failures) |
| `--help` | `-h` | Show help message |

## How It Works

1. **Get repository state** — reads current branch and commit. Warns if there are uncommitted changes (which are intentionally excluded from the clone, matching CI behavior).
2. **Create temp directory** — creates a fresh workspace under the OS temp dir.
3. **Clone repository** — runs `git clone --no-local` from the original repo into the temp dir.
4. **Checkout commit** — checks out the exact commit HEAD points to, so validation matches what would be pushed.
5. **Install dependencies** — runs `pnpm install` in the clone.
6. **Build** — runs `pnpm build` in the clone.
7. **Run tests** — runs `pnpm test` (full suite by default), `--smoke` for a subset, or skipped with `--no-tests`.

After completion (pass or fail), the temp directory is cleaned up unless `--keep-temp` is set.

## Exit Codes

- **0** — validation passed; safe to push.
- **1** — validation failed, or an unexpected error occurred. Check the output for details.
