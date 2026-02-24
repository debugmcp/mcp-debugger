# packages\shared\package.json
@source-hash: 8611f5cb0433217f
@generated: 2026-02-24T01:54:06Z

Package configuration for shared MCP debugger components. This package provides shared interfaces, types, and utilities for the MCP (Model Control Protocol) debugger ecosystem.

## Key Configuration Elements

**Package Identity (L1-10)**
- Name: `@debugmcp/shared` - scoped package for shared components
- Version: 0.18.0 - semantic versioning
- Purpose: Shared interfaces, types, and utilities for MCP Debugger
- Repository: GitHub monorepo with directory-specific config

**Module System (L11-27)**
- Entry point: `./dist/index.js` (L11) with TypeScript declarations (L12)
- ES Module type (L13) with dual CJS/ESM exports (L14-20)
- TypeScript version mapping for all paths to dist directory (L21-27)

**Build Pipeline (L28-36)**
- TypeScript compilation with custom declaration ensuring script
- Clean builds with rimraf for dist cleanup
- Vitest for testing with watch mode and coverage reporting

**Dependencies (L53-62)**
- Production: `@vscode/debugprotocol` for DAP (Debug Adapter Protocol) types
- Development: TypeScript toolchain, Vitest testing framework, coverage tools

**Distribution (L63-70)**
- Files whitelist: dist, README, LICENSE for npm publishing
- Public access configuration for scoped package

## Architecture Notes

This is a foundational package in a monorepo structure, providing shared type definitions and utilities for MCP debugging tools. The heavy emphasis on TypeScript tooling and DAP dependency suggests this package exports type-safe interfaces for debug protocol communication.