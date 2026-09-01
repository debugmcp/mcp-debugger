# Push Validation Script

Validates your **committed** changes by installing, building and testing them in a clean
clone, so local-only state — uncommitted files, stale `dist/`, a hand-patched `node_modules` —
cannot make a broken commit look green.

## Usage

```bash
npm run validate         # Clean clone + install + build + full test suite
npm run validate:quick   # Clean clone + install + build only, no tests
npm run validate:smoke   # Clean clone + install + build + a three-file smoke subset
```

Or run directly:

```bash
node scripts/validate-push.js [options]
```

## Command Line Options

| Flag | Short | Description |
|------|-------|-------------|
| `--no-tests` | | Skip running tests |
| `--smoke` | | Run a three-file smoke subset instead of the full suite (see step 7) |
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
7. **Run tests** — one of:
   - default: `pnpm test`, i.e. the whole Vitest run (that script builds and runs the Docker image check first, so this repeats step 6's work).
   - `--smoke`: `pnpm test` limited to three files — `tests/unit/index.test.ts`, `tests/core/unit/server/server-initialization.test.ts`, and `tests/core/unit/server/server-lifecycle.test.ts` (process entry plus server initialization and lifecycle). It goes through `pnpm test` too, so the build and Docker check still run before the subset.
   - `--no-tests`: skipped entirely.

After completion (pass or fail), the temp directory is cleaned up unless `--keep-temp` is set.

## What It Does Not Cover

This is a clean-clone **install/build/test** check, not a full replica of CI. It does not run:

- `pnpm run lint` — CI runs it in both the `build-and-test` and `lint` jobs
- `pnpm run typecheck:all` — CI's `lint` job runs it, as does `.husky/pre-push`

So a green `validate` does not by itself mean green CI. Run those two yourself, or let the
pre-push hook run them for you.

## Exit Codes

- **0** — validation passed; safe to push.
- **1** — validation failed, or an unexpected error occurred. Check the output for details.
