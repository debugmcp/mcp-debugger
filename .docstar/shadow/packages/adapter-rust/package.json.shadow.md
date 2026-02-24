# packages\adapter-rust\package.json
@source-hash: 89e8efc294089224
@generated: 2026-02-24T01:54:08Z

## Package Configuration for Rust Debug Adapter

This package.json configures `@debugmcp/adapter-rust`, a TypeScript/Node.js package that provides Rust debugging capabilities through CodeLLDB integration for the MCP Debugger ecosystem.

### Package Identity & Structure
- **Name**: `@debugmcp/adapter-rust` (L2) - Scoped package for Rust debugging adapter
- **Version**: 0.18.0 (L3) - Current release version
- **Module Type**: ES modules with TypeScript compilation (L5, L19)
- **Entry Points**: Compiled JavaScript at `./dist/index.js` with TypeScript definitions (L6-12)

### Build & Distribution
- **Build Process**: TypeScript compilation via `tsc` (L19-20)
- **Vendor Script**: Custom CodeLLDB vendoring through `scripts/vendor-codelldb.js` (L21)
- **Distribution Files**: Compiled `dist/` and vendored dependencies in `vendor/` (L14-17)
- **Clean Targets**: Separate cleanup for build artifacts and vendor files (L22-23)

### Core Dependencies
- **@debugmcp/shared** (L28): Workspace dependency for shared debugging utilities
- **@vscode/debugprotocol** (L29): VS Code Debug Adapter Protocol implementation
- **execa** (L30): Process execution library for spawning debug processes

### Development Infrastructure
- **Testing**: Vitest framework with watch mode support (L24-25)
- **Vendoring Tools**: extract-zip, node-fetch, progress for downloading/managing CodeLLDB (L34-36)
- **Build Tools**: TypeScript 5.3+, rimraf for cleanup (L37-39)
- **Node Requirements**: Node.js 18+ (L41-42)

### Architecture Notes
This adapter follows the MCP (Model Context Protocol) debugger pattern, specifically targeting Rust debugging through CodeLLDB. The vendoring system suggests offline/bundled distribution of debug tools. The workspace dependency structure indicates this is part of a larger monorepo debugging ecosystem.