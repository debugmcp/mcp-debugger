# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the TypeScript CLI and server core that power the Debug MCP runtime.
- `packages/` hosts 17 workspace modules. Twelve carry their own `src/` trees (`@debugmcp/shared`, `adapter-mock`, `adapter-python`, `adapter-ruby`, `adapter-javascript`, `adapter-rust`, `adapter-go`, `adapter-java`, `adapter-dotnet`, `adapter-cpp`, `codelldb-common`, `mcp-debugger`); the other five — `codelldb-win32-x64`, `codelldb-linux-x64`, `codelldb-linux-arm64`, `codelldb-darwin-x64`, `codelldb-darwin-arm64` — are prebuilt CodeLLDB payloads with no TypeScript in them. A `packages/logs/` may linger in a checkout that ran pre-#637 builds (server logs now default to `os.tmpdir()/debug-mcp-server/`); it is not a package and not in the repository — `.gitignore`'s `logs/` rule covers it.
- `tests/` is grouped by scope: `unit/`, `core/unit/`, `adapters/*/`, `integration/`, `e2e/`, plus shared utilities in `tests/test-utils/` and fixtures under `tests/fixtures/`.
- `docs/` covers design notes; `examples/` hosts adapter recipes; `scripts/` stores CI helpers.
- Build artifacts land in `dist/`; recorded assets and Docker helpers live in `assets/` and `docker/`.

## Build, Test, and Development Commands
- `pnpm install` sets up the monorepo (respect the generated `pnpm-lock.yaml`).
- `pnpm build` compiles every package and emits the aggregated `dist/index.js`.
- `pnpm dev` launches the TypeScript entry point via `ts-node` for quick feedback.
- `pnpm test` performs a full build, ensures Docker images are ready, and runs Vitest across all suites.
- Targeted runs: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm test:coverage`.
- `pnpm lint` runs ESLint over `src/**/*.ts`, `packages/*/src/**/*.ts`, and `scripts/**/*.{js,mjs,cjs}`. `pnpm lint:fix` is narrower — it is `eslint src/**/*.ts --fix` — so it does **not** auto-fix everything `pnpm lint` reports; findings under `packages/` and `scripts/` have to be fixed by hand.
- `pnpm typecheck` type-checks the shipped sources via `tsconfig.typecheck.json` (no build needed; the root `tsc -p tsconfig.json` checks nothing). `pnpm typecheck:tests` runs the per-file ratchet over the test trees against `tests/typecheck-baseline.json`; `pnpm typecheck:tests:update` re-records that baseline and `pnpm typecheck:tests:raw` emits unfiltered `tsc` output. `pnpm typecheck:all` runs both, and is the exact command pre-push and CI run.
- **Run the whole dev-loop gate before pushing.** It is lint -> baseline committed -> `typecheck:all` -> clean build -> `test:unit` + `test:integration`, and both `.husky/pre-push` and CI enforce it; `typecheck:all` is the step most likely to block a push. It is documented once, canonically, in [CONTRIBUTING.md — Dev-Loop Gate](CONTRIBUTING.md#dev-loop-gate). Follow that section rather than any restatement of it.

## Coding Style & Naming Conventions
- Source files use ES modules, TypeScript strict mode, and two-space indentation; prefer `PascalCase` for classes, `camelCase` for functions, and `SCREAMING_SNAKE_CASE` for constants.
- Align new utilities with the patterns in `src/utils/` (utility modules — mix of pure functions and service classes — with explicit exports). Most new code, though, belongs in one of the two structural homes the server/session refactor created: MCP-facing work goes under `src/server/` (schema in `tool-schemas.ts`, one handler module per tool family in `src/server/handlers/`, dispatched by the `TOOL_HANDLERS` record in `handlers/index.ts`), and debug-operation work goes into a slice under `src/session/{launch,attach,breakpoints,execution,inspection,jvm,mirror}/` reached through `OperationsContext` (`src/session/operations-context.ts`) — not as a new method body in `session-manager-operations.ts`, which is a facade of thin delegates.
- ESLint (`eslint.config.js`) enforces TypeScript recommended rules, unused-variable patterns, and environment-specific overrides (e.g., relaxed rules for test files and mock utilities)—run it before opening a PR.
- Avoid default exports; monorepo packages rely on named exports for tree shaking and test isolation.

## Testing Guidelines
- Vitest drives all automated suites; place new core specs under `tests/core/` and adapter-specific cases alongside their adapter folder.
- Mirror filename patterns like `*.test.ts`; prefer descriptive names (`debug-session-manager.integration.test.ts`) over numeric suffixes.
- `pnpm test:coverage` produces Istanbul reports and triggers `analyze-coverage.js`; the thresholds in `vitest.config.ts` are enforced (statements 90, branches 80), so keep new code at or above them.
- Use `pnpm test:no-python` or `pnpm test:no-docker` only when the toolchain is genuinely absent — they set `SKIP_PYTHON_TESTS`/`SKIP_DOCKER_TESTS` and quietly stop exercising the very thing you may have changed.

## Commit & Pull Request Guidelines
- Follow the existing history: short present-tense subject lines (`feat(scope): ...`, `chore: ...`) with details in the body when needed.
- Run `scripts/safe-commit.sh` (or the `pnpm commit:safe` alias) before pushing — this runs a mandatory personal information check and then commits (use `--skip-tests` to pass `git commit --no-verify`, which bypasses the whole pre-commit hook — the personal-paths check, the staged build-artifact and `.tgz` guards, and docstar — while the script still runs its own personal info check). Note that `--no-verify` on a *commit* skips none of the [Dev-Loop Gate](CONTRIBUTING.md#dev-loop-gate); that runs on push.
- PRs should describe behavior changes, reference GitHub issues or roadmap items, link relevant artifacts (logs, screenshots), and highlight test commands executed.
- Update affected docs or examples alongside code so downstream agents stay in sync.
