# @debugmcp/adapter-javascript (Task 1 — Scaffold)

This package provides the initial skeleton for a JavaScript/TypeScript debug adapter in the MCP Debugger monorepo. It is discoverable and compiles, but does not include functional js-debug integration yet. Later tasks will add behavior and wiring.

Key points
- ESM TypeScript project with dist/ output and type declarations
- Exports JavascriptAdapterFactory as the entry point for dynamic loading
- Minimal JavascriptDebugAdapter that type-checks against @debugmcp/shared
- Placeholder utils and types
- Vendor folder placeholder for js-debug (populated in later tasks)
- Uses .js suffix on relative TS imports to match ESM resolution

Status and scope
- This is a non-functional adapter stub for Task 1 only
- Environment validation and adapter command building are trivial placeholders
- DebugLanguage enum currently lacks a JAVASCRIPT member; a TODO is noted in the adapter

Build and test
- Build: pnpm -w -F @debugmcp/adapter-javascript run build
- Test:  pnpm -w -F @debugmcp/adapter-javascript run test

Validation
- Node.js 14+ required
- Requires bundled js-debug vendor file at vendor/js-debug/vsDebugServer.js
- Optional TypeScript runners: tsx or ts-node recommended; absence only results in a warning
- The factory-level validation is fast and has no side effects; it does not spawn processes or touch network
- To vendor js-debug, use the build:adapter script when available: pnpm -w -F @debugmcp/adapter-javascript run build:adapter

Structure
- src/index.ts exports the factory by name: JavascriptAdapterFactory
- src/javascript-adapter-factory.ts extends the shared AdapterFactory
- src/javascript-debug-adapter.ts provides stub methods and safe defaults
- src/utils/* and src/types/* contain placeholders for later tasks

Notes
- No core registration is added in Task 1; that is handled in a later task
- Keep using .js in relative imports (e.g., ./javascript-adapter-factory.js)

## Vendoring js-debug

Populate the Microsoft js-debug adapter into this package so that validation passes and later tasks can spawn it via `--stdio`.

Prereqs
- Node 18+ for the vendoring script (uses global `fetch` and AbortController)
- Optional: `GH_TOKEN` environment variable to avoid GitHub API rate limits (recommended behind corporate proxies)

Commands
- Get the latest prebuilt artifact:
  - pnpm -w -F @debugmcp/adapter-javascript run build:adapter
- Pin to a specific tag (example):
  - JS_DEBUG_VERSION=v1.95.0 pnpm -w -F @debugmcp/adapter-javascript run build:adapter
- Force a rebuild (ignore cache if already present):
  - JS_DEBUG_FORCE_REBUILD=true pnpm -w -F @debugmcp/adapter-javascript run build:adapter
- Build from source (slower; requires git and a package manager):
  - JS_DEBUG_BUILD_FROM_SOURCE=true pnpm -w -F @debugmcp/adapter-javascript run build:adapter

Vendoring tips
- Prebuilt (default):
  - pnpm -w -F @debugmcp/adapter-javascript run build:adapter
- Source fallback:
  - Windows (cmd):  cmd /c "set JS_DEBUG_BUILD_FROM_SOURCE=true && pnpm -w -F @debugmcp/adapter-javascript run build:adapter"
  - Bash:           JS_DEBUG_BUILD_FROM_SOURCE=true pnpm -w -F @debugmcp/adapter-javascript run build:adapter
- Local override (bypass network; requires an existing vsDebugServer.js on disk):
  - Windows (cmd):  cmd /c "set JS_DEBUG_FORCE_REBUILD=true && set JS_DEBUG_LOCAL_PATH=C:\path\to\vsDebugServer.js && pnpm -w -F @debugmcp/adapter-javascript run build:adapter"
  - Bash:           JS_DEBUG_FORCE_REBUILD=true JS_DEBUG_LOCAL_PATH=/abs/path/vsDebugServer.js pnpm -w -F @debugmcp/adapter-javascript run build:adapter

Notes on normalization
- Upstream js-debug now ships the DAP server as js-debug/src/dapDebugServer.js (prebuilt) or dist/src/dapDebugServer.js (source build on newer tags).
- The vendoring script automatically normalizes either file to the canonical path: vendor/js-debug/vsDebugServer.js.
- For source builds on Windows/macOS/Linux, large Playwright downloads are skipped by setting PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 during install.

Windows (source fallback example):
- cmd /c "set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 && set JS_DEBUG_BUILD_FROM_SOURCE=true && pnpm -w -F @debugmcp/adapter-javascript run build:adapter"

Bash (source fallback example):
- PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 JS_DEBUG_BUILD_FROM_SOURCE=true pnpm -w -F @debugmcp/adapter-javascript run build:adapter

Expected outputs
- vendor/js-debug/vsDebugServer.js
- vendor/js-debug/vsDebugServer.js.sha256
- vendor/js-debug/manifest.json (metadata: source, repo, version, asset, sha256, fetchedAt)

Determinism and safety
- The script writes the artifact and checksum into vendor/js-debug/
- Safe re-runs: if the artifact already exists, the script exits 0 unless `JS_DEBUG_FORCE_REBUILD=true` is set
- The script does not run automatically in CI or on postinstall

Validation
- After vendoring, `JavascriptAdapterFactory.validate()` should pass the vendor check locally. It looks for:
  - vendor/js-debug/vsDebugServer.js (relative to the package source/dist layout)
- Runtime Node requirement for validation remains 14+ (the vendoring script itself requires Node 18+)

Troubleshooting
- 403 rate limit or forbidden
  - Set GH_TOKEN (or GITHUB_TOKEN) to increase API limits
  - Example (PowerShell): `$env:GH_TOKEN="ghp_xxx"; pnpm -w -F @debugmcp/adapter-javascript run build:adapter`
- 404 tag not found
  - Verify `JS_DEBUG_VERSION` (e.g., try `latest` or a known tag like `v1.95.0`)
- No matching asset found
  - Try pinning a specific `JS_DEBUG_VERSION`
  - Or enable source fallback: `JS_DEBUG_BUILD_FROM_SOURCE=true`
- vsDebugServer.js not found after extraction
  - Packaging may have changed; file an issue
  - As a workaround, try the source fallback
- Corporate proxies / MITM
  - Respect `HTTPS_PROXY`/`HTTP_PROXY` environment variables when running the script

Notes on cross-platform
- The vendoring script is cross-platform (Windows/macOS/Linux)
- Paths are normalized in logs for readability but native paths are used for file operations
