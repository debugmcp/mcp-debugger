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
- **`npm run prebuild`**: Removes entire `dist/` directory to prevent stale artifacts
- **`npm run build:clean`**: Explicit clean build (same as `npm run build` due to prebuild)

### Package Build Commands
- **`pnpm --filter @debugmcp/mcp-debugger build`**: Builds the MCP debugger package
  - Uses **tsup** (replacing esbuild) with `noExternal: [/./]` to bundle all dependencies
  - Creates `packages/mcp-debugger/dist/cli.mjs` - self-contained CLI bundle (~3MB)
  - Creates `packages/mcp-debugger/dist/proxy/proxy-bundle.cjs` - self-contained proxy bundle
  - Copies compiled proxy, errors, adapters, session, and utils directories from root dist
  - Copies js-debug adapter for JavaScript debugging support

### Scripts That Require Fresh Builds
The following scripts now include `npm run build` to ensure fresh artifacts:

#### Test Scripts
- **`test`**: Full test suite (unit + integration)
- **`test:integration`**: Integration tests that use the compiled server
- **`test:e2e`**: End-to-end tests that run the actual server
- **`test:e2e:smoke`**: Smoke tests for basic functionality
- **`test:coverage`**: Coverage tests across all test types
- **`test:coverage:quiet`**: Silent coverage run
- **`test:coverage:json`**: JSON output for CI/CD

#### Container Scripts
- **`test:e2e:container`**: Builds fresh Docker image (includes `--no-cache`)
- **`docker-build`**: Builds Docker image (builds inside container)

### Scripts That DON'T Require Builds
These scripts work directly with source files or don't execute code:
- **`test:unit`**: Unit tests run directly on TypeScript source
- **`lint`**: Static analysis of TypeScript source
- **`dev`**: Development mode using ts-node (no compilation)

## Common Pitfalls

### 1. Stale Build Artifacts
**Problem**: Running tests without rebuilding can use outdated code, leading to:
- Tests passing when they should fail
- Tests failing when they should pass
- Confusion about whether changes are working

**Solution**: The build pipeline now automatically runs `npm run build` for all scripts that need it.

### 2. Path Translation in Containers
**Problem**: Container tests expect different path handling than host tests.
- Host mode: Absolute paths are allowed
- Container mode: Absolute paths are rejected with an error

**Solution**: The E2E container test now correctly expects path rejection errors.

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

The proxy bootstrap (`src/proxy/proxy-bootstrap.js`) has been simplified:
- **If bundle exists**: Uses the bundled proxy (`proxy-bundle.cjs`)
- **If no bundle**: Uses the unbundled proxy files (development mode)
- **No environment variables required**: Simply checks for bundle file existence

### Why Separate Bundles?
- The proxy runs as a **separate child process** for DAP communication
- It needs to be a standalone executable that can be spawned independently
- The bundled version includes all npm dependencies (fs-extra, winston, uuid, etc.)
- This allows the application to run via npx without installing dependencies
- Enables distribution in minimal Alpine containers without npm packages

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
- Used by `scripts/bundle.js` to create `dist/bundle.cjs` (main server) and `dist/proxy-bundle.cjs` (proxy)
- These root bundles are used in Docker builds and direct execution scenarios

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
  - Uses minimal Alpine runtime with only Node.js (no npm)
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
This is now expected behavior - absolute paths are rejected in container mode.

### "Build seems stuck"
The `prebuild` script removes the entire `dist/` directory. If it's locked by a running process, stop all Node processes first.
