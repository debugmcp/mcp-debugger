# packages\adapter-python\package.json
@source-hash: 881c83a4dba55ee2
@generated: 2026-02-24T01:54:05Z

Package configuration for Python debug adapter in the MCP debugger ecosystem. This adapter enables debugging Python applications through the VSCode Debug Protocol using debugpy.

## Key Configuration Elements

**Package Identity (L2-4)**: Scoped package `@debugmcp/adapter-python` v0.18.0, implementing Python debugging capabilities for MCP debugger.

**Module Setup (L5-10)**: ES module configuration with TypeScript build outputs - main entry at `dist/index.js` (L6) and type definitions at `dist/index.d.ts` (L7). Distribution limited to `dist` folder (L8-10).

**Build Pipeline (L11-17)**: TypeScript-based build system with standard development scripts:
- `build`/`build:ci` (L12-13): TypeScript compilation with CI force flag
- `clean` (L14): Removes build artifacts and TypeScript build info
- `test`/`test:watch` (L15-16): Vitest test runner configurations

**Dependencies (L18-31)**:
- Runtime deps (L18-22): Workspace-linked shared utilities, VSCode Debug Protocol implementation, and system path utilities
- Dev deps (L23-28): TypeScript toolchain and testing framework
- Peer dependency (L29-31): Explicit version constraint on shared package for compatibility

**Publishing (L32-34)**: Configured for public npm registry access.

## Architecture Notes

This adapter package bridges Python debugging (via debugpy) with the MCP debugger framework, leveraging the VSCode Debug Adapter Protocol for standardized debugging communication. The workspace dependency structure suggests a monorepo architecture with shared debugging utilities.