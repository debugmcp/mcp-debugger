# packages\adapter-go\package.json
@source-hash: a3be04840745124f
@generated: 2026-02-24T01:54:05Z

## Go Debugging Adapter Package Configuration

Package manifest for `@debugmcp/adapter-go`, a Go language debugging adapter that integrates with mcp-debugger using Delve (Go's native debugger).

### Package Metadata
- **Name & Version**: `@debugmcp/adapter-go` v0.18.0 (L2-3)
- **Description**: Go debugging adapter for mcp-debugger using Delve (L4)
- **Module Type**: ES module with TypeScript compilation target (L5)

### Build & Distribution
- **Entry Points**: Main module at `./dist/index.js` with TypeScript definitions at `./dist/index.d.ts` (L6-7, L9-12)
- **Published Files**: Only `dist/` directory included in npm package (L14-16)
- **Build Pipeline**: TypeScript compilation via `tsc`, with separate CI build target (L18-19)
- **Development Tools**: ESLint for linting, Vitest for testing, rimraf for cleanup (L20-22)

### Dependencies
- **Runtime Dependencies** (L24-27):
  - `@debugmcp/shared`: Workspace monorepo shared utilities
  - `@vscode/debugprotocol`: VS Code Debug Adapter Protocol implementation
- **Development Dependencies** (L28-34): Node.js types, TypeScript toolchain, testing framework

### Package Classification
Keywords indicate this is a **debug adapter** specifically for:
- MCP (Model Context Protocol) integration (L36)
- Go/Golang language support (L38-39)
- Delve debugger backend (L40)
- DAP (Debug Adapter Protocol) compliance (L41)

### Repository Structure
Part of `mcp-debugger` monorepo at `packages/adapter-go` (L45-49), suggesting a multi-language debugging platform architecture.