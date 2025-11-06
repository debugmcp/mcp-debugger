# JavaScript/TypeScript Adapter Integration

This document explains how the JavaScript/TypeScript debug adapter is integrated into the MCP Debugger and how to enable it in a modular way.

Goals:
- Keep adapters modular: no automatic installation or build of optional adapters.
- Provide a clear developer workflow to include the JavaScript adapter when desired.
- Ensure the server can dynamically discover and load the adapter if present.
- Report the JavaScript language in `list_supported_languages` with `installed: true` when the adapter package is available.

## Modular by default

The MCP Debugger ships without auto-installing optional adapters. Only required adapters (mock, python) are part of the default build. JavaScript is available as an optional adapter in a separate package:

- Package name: `@debugmcp/adapter-javascript`
- Factory export: `JavascriptAdapterFactory`
- Vendor dependency: `packages/adapter-javascript/vendor/js-debug/vsDebugServer.js`

There is no automatic install/build on first use. This keeps the core lightweight and reduces unexpected network operations.

## Developer workflows

You have two ways to include the JavaScript adapter during development:

1) Build just the JS adapter (recommended for local iteration)
- Vendoring/build:
  - `pnpm -w -F @debugmcp/adapter-javascript build`
  - `pnpm -w -F @debugmcp/adapter-javascript run build:adapter`
- This compiles the adapter and ensures the vendored `js-debug` server is present.

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

Additionally, the dev container bootstrapping path includes:
- `src/container/dependencies.ts` entries to `tryRegister('javascript', 'JavascriptAdapterFactory')`
- This ensures local monorepo builds resolve to `node_modules/@debugmcp/adapter-javascript/dist/index.js`

## Shared language metadata

The shared model defines:
- `DebugLanguage.JAVASCRIPT = 'javascript'`
- Display name: JavaScript/TypeScript
- Default executable: `node` (resolved via utility logic in the adapter)

Unit tests were updated to reflect the addition:
- `tests/core/unit/session/models.test.ts` now expects three languages and verifies inclusion of `javascript`.

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
  - `resolveNodeExecutable` → resolves the Node runtime path in a cross-platform, deterministic manner.

Ensure `packages/adapter-javascript/package.json` points `main/types/exports` to `dist` and includes `vendor/js-debug` in the `files` array for publishing.
