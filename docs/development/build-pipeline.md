# Build Pipeline Documentation

## Overview
This document explains the MCP Debugger build pipeline, which scripts require fresh builds, and common pitfalls related to stale build artifacts.

## The `dist/` Directory
The `dist/` directory contains the compiled TypeScript output and is the source of truth for running the MCP server. All runtime execution uses the JavaScript files in this directory, not the TypeScript source files.

## Build Scripts

### Core Build Commands
- **`npm run build`**: Compiles TypeScript to JavaScript in `dist/` directory
  - Automatically runs `prebuild` first (cleans old artifacts)
  - Runs `postbuild` to copy necessary files (proxy bootstrap)
- **`npm run prebuild`**: `node scripts/clean-src-artifacts.cjs && rimraf dist && pnpm run vendor:adapters`
  - Deletes stray `.js` / `.d.ts` / `.map` artifacts from `packages/*/src/` — stale artifacts there confuse TypeScript module resolution. Only the `packages/` tree is walked (`scripts/clean-src-artifacts.cjs` builds its root from `packages`), so the root `src/` is untouched and the legitimate `src/proxy/proxy-bootstrap.js` source is never a candidate
  - Removes `dist/` so no stale compiled output survives
  - Re-runs `vendor:adapters` (`pnpm run -r --if-present build:adapter`). Only three packages define that script — `adapter-java` (compiles the JDI bridge), `adapter-javascript` (vendors js-debug), and `codelldb-common` (vendors CodeLLDB) — and each skips when its artifact is already fresh, so on a warm tree this re-vendors nothing
- **`npm run build:clean`**: Explicit clean build (same as `npm run build` due to prebuild)

### Package Build Commands
- **`pnpm --filter @debugmcp/mcp-debugger build`**: Builds the MCP debugger package
  - Uses **tsup** (for the distribution package) with `noExternal: [/./]` to bundle all dependencies
  - Creates `packages/mcp-debugger/dist/cli.mjs` - self-contained CLI bundle (~3MB)
  - Creates `packages/mcp-debugger/dist/proxy/proxy-bundle.cjs` - self-contained proxy bundle
  - Copies compiled proxy, errors, adapters, session, and utils directories from root dist
  - Copies vendored js-debug assets from `packages/adapter-javascript/vendor/js-debug` into `packages/mcp-debugger/dist/vendor/js-debug`

### Scripts That Require Fresh Builds
The following scripts now include `npm run build` to ensure fresh artifacts:

#### Test Scripts
- **`test`**: `pnpm run build && pnpm run pretest:docker && vitest run` — the whole Vitest run (the `unit`, `integration` and `e2e` projects)
- **`test:e2e`**: End-to-end tests that run the actual server
- **`test:e2e:smoke`**: Smoke tests for basic functionality
- **`test:coverage`**: Coverage tests across all test types
- **`test:coverage:json`**: JSON output for CI/CD

Two neighbours look like they belong in that list but do not: `test:integration` (`vitest run --project integration`) and `test:coverage:quiet` (`vitest run --coverage --reporter=dot --silent`) have no `pre*` hook and no inline build, so they run against whatever `dist/` is already on disk. Build first yourself.

#### Container Scripts
- **`test:e2e:container`**: Builds fresh Docker image (includes `--no-cache`)
- **`docker-build`**: Runs `docker build`; the Dockerfile itself builds from source during image creation (multi-stage build)

### Scripts That DON'T Require Builds
These scripts work directly with source files or don't execute code:
- **`test:unit`**: Unit tests run directly on TypeScript source
- **`lint`**: Static analysis of TypeScript source
- **`typecheck`**: `tsc -p tsconfig.typecheck.json` over `src/` and `packages/*/src` — type-check only, no emit
- **`typecheck:tests`**: The test-suite ratchet (`scripts/typecheck-tests-ratchet.mjs`) against `tests/typecheck-baseline.json`
- **`typecheck:all`**: Both of the above — the exact command the `lint` CI job and the pre-push hook run
- **`dev`**: Runs the server from source via `ts-node-esm src/index.ts` (no compilation)

`typecheck:all` is the fastest gate that still answers "does this compile?" — `.husky/pre-push` budgets it at roughly 15 seconds, against minutes for a clean build. Reach for it while iterating; the clean build in the pre-push hook remains the authoritative compile.

## Common Pitfalls

### 1. Stale Build Artifacts
**Problem**: Running tests without rebuilding can use outdated code, leading to:
- Tests passing when they should fail
- Tests failing when they should pass
- Confusion about whether changes are working

**Solution**: The build pipeline now automatically runs `npm run build` for all scripts that need it.

### 2. Path Translation in Containers
**Problem**: Container tests expect different path handling than host tests. The two modes are
asymmetric, and it is easy to state the asymmetry backwards.

- **Host mode** passes the path through unchanged (`resolvePathForRuntime`,
  `src/utils/container-path-utils.ts:69`) and then **rejects anything not absolute** --
  `SimpleFileChecker` returns `Path must be absolute. Received: "<path>"`
  (`src/utils/simple-file-checker.ts:49`).
- **Container mode** rejects nothing. Every path is re-rooted under `MCP_WORKSPACE_ROOT`:
  `examples/x.py` and `/examples/x.py` both become `/workspace/examples/x.py`, and a path
  already under the workspace root is returned as-is (the operation is idempotent).

So container mode is the *permissive* one -- it is the only mode that accepts a relative path.

**Solution**: the container path tests assert that re-rooting
(`tests/unit/utils/container-path-utils.spec.ts`), not a rejection.

### 3. Manual Testing
When manually testing changes:
```bash
# Always rebuild before testing
npm run build

# Or use the test commands that auto-build
npm run test:e2e
```

## Proxy Bundling

The DAP proxy runs as a separate child process and requires its own bundle for compatibility. The proxy bundling is handled by the MCP debugger package build:

1. **MCP Debugger CLI** is bundled as `packages/mcp-debugger/dist/cli.mjs` using tsup
2. **Proxy** is bundled as `packages/mcp-debugger/dist/proxy/proxy-bundle.cjs` using tsup

Both bundles include all necessary dependencies (using tsup's `noExternal` flag), allowing the application to run without requiring node_modules installation.

The proxy bootstrap (`src/proxy/proxy-bootstrap.js`, copied to `dist/proxy/proxy-bootstrap.js`) has been simplified:
- **If bundle exists**: Uses the bundled proxy (`proxy-bundle.cjs`)
- **If no bundle**: Falls back to `dap-proxy-entry.js` (the unbundled proxy entrypoint for development mode)
- **Bootstrap sets `DAP_PROXY_WORKER=true`**: This environment variable is set internally by the bootstrap to signal worker-mode detection to the proxy entry point; the bootstrap simply checks for bundle file existence to decide which proxy to use

### Why Separate Bundles?
- The proxy runs as a **separate child process** for DAP communication
- It needs to be a standalone executable that can be spawned independently
- The bundled version includes all npm dependencies (fs-extra, winston, uuid, etc.)
- This allows the application to run via npx without installing dependencies
- Enables a runtime image that needs no npm and no dependency install — the production `Dockerfile` copies the `node` binary and the bundles into a plain `ubuntu:26.04` stage, plus the handful of packages the adapters load dynamically

### NPX Distribution
The MCP debugger can be distributed via npm/npx:
```bash
npx @debugmcp/mcp-debugger stdio
```

This works because:
- The CLI bundle (`cli.mjs`) includes all workspace dependencies
- The proxy bundle (`proxy-bundle.cjs`) includes all proxy dependencies
- No external dependencies need to be installed

## Build Process Architecture

### TypeScript Compilation
1. **Root `src/` → Root `dist/`**: Main server TypeScript files compile to root dist
2. **Packages `src/` → Packages `dist/`**: Each package has its own TypeScript compilation

### Bundling
The project uses two bundling tools for different purposes:

**tsup** (for the `@debugmcp/mcp-debugger` distribution package):
- **`noExternal: [/./]`**: Bundles all dependencies, including workspace packages
- **ESM output**: CLI bundle uses `.mjs` extension for ESM compatibility
- **CJS output**: Proxy bundle uses `.cjs` for CommonJS (required by child process)

**esbuild** (for root-level bundles):
- Used by `scripts/bundle.js` to create `dist/bundle.cjs` (main server) and `dist/proxy/proxy-bundle.cjs` (proxy)
- These root bundles are available for direct execution scenarios. The two Docker-related entrypoints use different files: `scripts/docker-entry.sh` (used by the production Dockerfile) runs `dist/bundle.cjs`, while `docker/docker-entrypoint.sh` (a legacy test entrypoint) runs `dist/index.js`

### Build Artifacts Management
Build artifacts are properly managed via `.gitignore`:
- `dist/` directories are ignored (TypeScript compilation output)
- `packages/mcp-debugger/proxy/` is ignored (copied during build)
- `packages/mcp-debugger/vendor/` is ignored (copied js-debug adapter)
- TypeScript source files (`.ts`) are tracked in git
- JavaScript files (`.js`) in dist are generated and not tracked

## Docker Builds
Both Dockerfiles build from source inside the container:
- `Dockerfile`: Production multi-stage build
  - Builds packages including the new tsup bundling
  - Runtime stage is `ubuntu:26.04` (the builder is `node:26-slim`) — not Alpine; the `node` binary is copied out of the builder, and no npm or dependency install runs in the runtime stage
- `docker/test-ubuntu.dockerfile`: Test environment build

These are not affected by local `dist/` artifacts since they compile inside the container.

## CI/CD Considerations
- GitHub Actions should use scripts that include builds
- Local development can use `npm run dev` to avoid constant rebuilds
- The `prebuild` script ensures no mixing of old and new artifacts

## Best Practices
1. **Use the provided npm scripts** - They handle builds correctly
2. **Don't manually run vitest** without building first
3. **For development**, use `npm run dev` or `npm run test:watch`
4. **For CI/CD**, use the scripts that include builds
5. **When debugging issues**, always check if you have fresh builds

## Troubleshooting

### "Test is using old code"
Run `npm run build` or use a test script that includes building.

### "Container test failing with path errors"
Check which direction the test asserts. Container mode re-roots every path under
`MCP_WORKSPACE_ROOT` and rejects none; it is **host** mode that rejects a relative path. A
container test failing on paths usually means `MCP_WORKSPACE_ROOT` is unset or the file is not
under the mounted workspace -- not that the path was "too absolute".

### "Build seems stuck"
The `prebuild` script removes `dist/` and then re-runs `vendor:adapters`. On a warm tree that is close to a no-op — the three `build:adapter` scripts skip when their artifacts are already fresh — but on a cold tree it downloads the CodeLLDB and js-debug payloads from GitHub releases, which can take a while. If `dist/` is locked by a running process, stop all Node processes first.
