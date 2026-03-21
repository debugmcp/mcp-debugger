# JavaScript/TypeScript Adapter Integration

This document explains how the JavaScript/TypeScript debug adapter is integrated into the MCP Debugger and how to enable it in a modular way.

Goals:
- Keep adapters modular: no automatic installation or build of optional adapters.
- Provide a clear developer workflow to include the JavaScript adapter when desired.
- Ensure the server can dynamically discover and load the adapter if present.
- Report the JavaScript language in `list_supported_languages` with `installed: true` when the adapter package is available.

## Modular by default

The MCP Debugger ships without auto-installing optional adapters. The adapter loader has a hardcoded known-adapter registry for all seven languages (mock, python, javascript, rust, go, java, dotnet), but not all are built by default. JavaScript is available as an optional adapter in a separate package:

- Package name: `@debugmcp/adapter-javascript`
- Factory export: `JavascriptAdapterFactory`
- Vendor dependency: `packages/adapter-javascript/vendor/js-debug/vsDebugServer.cjs` (primary runtime entry used at runtime; `vsDebugServer.js` is the canonical vendored source from the upstream build). Note that the factory's `validate()` method checks for `.js` files during validation, while the runtime `buildAdapterCommand()` uses the `.cjs` entry point.

There is no automatic install/build on first use. This keeps the core lightweight and reduces unexpected network operations.

## Developer workflows

You have two ways to include the JavaScript adapter during development:

1) Build just the JS adapter (recommended for local iteration)
- Vendoring/build:
  - `pnpm -w -F @debugmcp/adapter-javascript build`
- The `build` script runs `tsc -b` and then automatically triggers vendoring via the `postbuild` hook (which runs `build-js-debug.js`). There is no need to run `build:adapter` separately after `build`.
- Running `pnpm -w -F @debugmcp/adapter-javascript run build:adapter` is only needed if you want to re-vendor js-debug without recompiling TypeScript.

2) Build all adapters (for contributors who want everything)
- Run the “all adapters” helper:
  - `pnpm -w run build:adapters:all`
- This will build mock, python, and javascript adapters in one go.

Notes:
- The default CI path and `build:packages` remain light and do not force building optional adapters.
- You can iterate on the JS adapter independently without impacting the rest of the repo.

## Dynamic loading

The server includes a catalog entry for JavaScript:
- Language: `javascript`
- Package: `@debugmcp/adapter-javascript`
- Description: “JavaScript/TypeScript debugger using js-debug”

At runtime, the adapter loader attempts to resolve and dynamically import the package. If available, it registers `JavascriptAdapterFactory`. If not found, it reports `installed: false` but still lists the adapter as “available”.

Additionally, the container bootstrapping path includes:
- `src/container/dependencies.ts` entries to `tryRegister('javascript', 'JavascriptAdapterFactory')`
- When the primary `import()` fails, the `AdapterLoader` constructs fallback file URLs relative to its own module location (via `import.meta.url`) pointing to `../../node_modules/@debugmcp/adapter-javascript/dist/index.js` and `../../packages/adapter-javascript/dist/index.js`

## Shared language metadata

The shared model defines:
- `DebugLanguage.JAVASCRIPT = 'javascript'`

The display name ("JavaScript/TypeScript") and default executable (`node`) are defined in the adapter implementation (`packages/adapter-javascript/`) and its factory metadata, not in the shared model itself. The shared model only carries the language enum value.

Unit tests were updated to reflect the addition:
- `tests/core/unit/session/models.test.ts` now expects seven languages (python, javascript, rust, go, java, dotnet, mock) and verifies inclusion of `javascript`.

## Verification steps

1) Build the adapter and vendor `js-debug`:
- `pnpm -w -F @debugmcp/adapter-javascript build`
- `pnpm -w -F @debugmcp/adapter-javascript run build:adapter`

2) Build all adapters (optional):
- `pnpm -w run build:adapters:all`

3) Run unit tests:
- `pnpm run test:unit`
- Expected: All tests pass, including language discovery and adapter loader tests.

4) Check supported languages via tests:
- `DebugLanguage` should include `'javascript'`.
- Server discovery tests validate that when `@debugmcp/adapter-javascript` is present, `installed: true` is reported for `javascript`.

## Launch coordination via AdapterLaunchBarrier

js-debug requires a short handoff period before clients can issue requests such as `threads` or `continue`. Previously this logic lived inside `ProxyManager`, which meant the core layer tracked a `jsDebugLaunchPending` flag, timers, and DAP event heuristics. The refactor introduces a shared hook so that the JavaScript adapter owns the behavior:

- The adapter implements `createLaunchBarrier(command, args?)`, returning a `JsDebugLaunchBarrier` when the command is `'launch'` (`packages/adapter-javascript/src/utils/js-debug-launch-barrier.ts`).
- `ProxyManager` delegates coordination to the barrier. It forwards proxy status updates, DAP events, and exit notifications without embedding language-specific branches.
- The barrier resolves once js-debug emits a `stopped` event or the transport connection is confirmed (`adapter_connected` after a short delay); it rejects if the proxy exits prematurely.
- Tests cover both sides: the adapter suite asserts the barrier’s behavior, and `tests/unit/proxy/proxy-manager-message-handling.test.ts` verifies both barrier modes — fire-and-forget (barrier returned, launch proceeds without awaiting response) AND await-response (no barrier, normal request/response correlation) — when a barrier is or is not returned.

This approach keeps the core proxy orchestration language-agnostic while allowing adapters to implement bespoke synchronization when necessary.

## No auto-install (by design)

Automatic installation of missing adapters is intentionally disabled by default to keep behavior explicit and reproducible. A future opt-in “install adapter” command (CLI/API) can:
- In monorepo dev: `pnpm -w -F @debugmcp/adapter-<lang> build`
- In packaged environments: `pnpm add @debugmcp/adapter-<lang>@^X.Y.Z` then build/vendor

This will be controlled by a server configuration flag (e.g., `autoInstallAdapters`), defaulting to `false`.

## Export surface

Adapter exports include:
- `JavascriptAdapterFactory` (factory used by the loader)
- `JavascriptDebugAdapter` (internal class)
- Utility re-exports include:
  - `resolveNodeExecutable` -- resolves the Node runtime path in a cross-platform, deterministic manner.
  - `detectTsRunners` -- detects available TypeScript runners (ts-node, tsx, etc.) in the environment.
  - `transformConfig` -- transforms generic launch config into js-debug-specific configuration.

The `packages/adapter-javascript/package.json` manifest includes:
- `"exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } }` -- ESM import with type declarations
- `"main": "dist/index.js"` -- fallback for legacy resolution
- `"types": "dist/index.d.ts"` -- top-level types field
- `"files": ["dist", "vendor/js-debug"]` -- published artifacts include both compiled code and vendored js-debug
