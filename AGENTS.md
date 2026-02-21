# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the TypeScript CLI and server core that power the Debug MCP runtime.
- `packages/` hosts workspace modules (`@debugmcp/shared`, `adapter-mock`, `adapter-python`, `adapter-javascript`, `adapter-rust`, `adapter-go`, `mcp-debugger`) with their own `src/` trees.
- `tests/` is grouped by scope: `core/`, `adapters/*/`, `e2e/`, plus shared utilities in `tests/test-utils/` and fixtures under `tests/fixtures/`.
- `docs/` covers design notes; `examples/` hosts adapter recipes; `scripts/` stores CI helpers.
- Build artifacts land in `dist/`; recorded assets and Docker helpers live in `assets/` and `docker/`.

## Build, Test, and Development Commands
- `pnpm install` sets up the monorepo (respect the generated `pnpm-lock.yaml`).
- `pnpm build` compiles every package and emits the aggregated `dist/index.js`.
- `pnpm dev` launches the TypeScript entry point via `ts-node` for quick feedback.
- `pnpm test` performs a full build, ensures Docker images are ready, and runs Vitest across all suites.
- Targeted runs: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm test:coverage`.
- `pnpm lint` applies the workspace-wide ESLint config; add `:fix` to auto-format when safe.

## Coding Style & Naming Conventions
- Source files use ES modules, TypeScript strict mode, and two-space indentation; prefer `PascalCase` for classes, `camelCase` for functions, and `SCREAMING_SNAKE_CASE` for constants.
- Align new utilities with the patterns in `src/utils/` (pure functions with explicit exports).
- ESLint (`eslint.config.js`) enforces import order, logger usage, and null checks—run it before opening a PR.
- Avoid default exports; monorepo packages rely on named exports for tree shaking and test isolation.

## Testing Guidelines
- Vitest drives all automated suites; place new core specs under `tests/core/` and adapter-specific cases alongside their adapter folder.
- Mirror filename patterns like `*.test.ts`; prefer descriptive names (`debug-session-manager.integration.test.ts`) over numeric suffixes.
- `pnpm test:coverage` produces Istanbul reports and triggers `analyze-coverage.js`; keep new code at or above existing coverage thresholds.
- Use `pnpm test:no-python` or `pnpm test:no-docker` only when dependencies are missing, per the fail-loudly policy in `commit-message.txt`.

## Commit & Pull Request Guidelines
- Follow the existing history: short present-tense subject lines (`feat(scope): ...`, `chore: ...`) with details in the body when needed.
- Run `scripts/safe-commit.sh` (or the `pnpm commit:safe` alias) before pushing — this runs a mandatory personal information check and then commits (use `--skip-tests` to bypass other pre-commit hooks while keeping the personal info check).
- PRs should describe behavior changes, reference GitHub issues or roadmap items, link relevant artifacts (logs, screenshots), and highlight test commands executed.
- Update affected docs or examples alongside code so downstream agents stay in sync.
