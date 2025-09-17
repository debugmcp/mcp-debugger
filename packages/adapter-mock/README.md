# @debugmcp/adapter-mock

Mock debug adapter for testing the MCP Debugger. This package provides a fully functional mock implementation of a Debug Adapter Protocol (DAP) server and adapter used heavily by tests and examples in the monorepo.

- MockDebugAdapter: In-memory adapter that simulates debugging life-cycle, state transitions, capabilities, and events.
- MockAdapterFactory: Factory that creates MockDebugAdapter instances.
- mock-adapter-process.ts: A small DAP server that can run over stdio or TCP for integration/e2e tests.

## Install (workspace)

This package is designed to be used via NPM workspaces within this monorepo.

- Root package.json includes "@debugmcp/adapter-mock": "workspace:*"
- Build order ensures @debugmcp/shared builds before this package

## Build

npm run build -w @debugmcp/adapter-mock

## Test

- Run just this package’s tests:
  npm test -w @debugmcp/adapter-mock

- Or run from repo root (Vitest is already configured to include packages/**):
  npm test

## Exports

import { MockAdapterFactory, MockDebugAdapter } from '@debugmcp/adapter-mock';
import type { MockAdapterConfig, MockErrorScenario } from '@debugmcp/adapter-mock';

## Notes

- Primary path resolution for the mock-adapter-process uses import.meta.url when running from the compiled package.
- A fallback path is provided for monorepo-root execution: packages/adapter-mock/dist/mock-adapter-process.js
