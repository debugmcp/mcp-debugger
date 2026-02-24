# tsconfig.json
@source-hash: d8d5072fcdd444e6
@generated: 2026-02-24T01:54:07Z

## TypeScript Root Configuration

This is a root TypeScript configuration file for a multi-package monorepo using project references. It serves as the central coordination point for TypeScript compilation across multiple packages.

### Configuration Structure

**Compiler Options (L2-23):**
- **Target & Module System**: ES2022 target with NodeNext module resolution (L3-5)
- **Build Output**: Outputs to `dist/` with declarations and source maps enabled (L11-13)
- **Source Organization**: Root directory set to `src/` (L14)
- **Path Mapping**: Configures `@/*` alias for `src/*` and wildcard for `node_modules/*` (L19-22)
- **Strict Mode**: Full strict TypeScript checking enabled (L9)
- **Module Features**: Isolated modules, ESM interop, and JSON module resolution (L6, L7, L15)

**Development Configuration (L24-27):**
- **ts-node Setup**: ESM mode with experimental Node.js specifier resolution for development execution

**Project References Architecture (L28-37):**
- **Empty Files Array**: Indicates this is a solution file, not a compilation target (L28)
- **Package References**: References to 5 adapter packages, shared utilities, debugger, and source config (L30-36)
  - `packages/shared` - Common utilities
  - `packages/adapter-mock` - Mock adapter implementation  
  - `packages/adapter-python` - Python runtime adapter
  - `packages/adapter-javascript` - JavaScript runtime adapter
  - `packages/adapter-rust` - Rust runtime adapter
  - `packages/mcp-debugger` - MCP debugging tools
  - `tsconfig.src.json` - Main source configuration

### Architectural Patterns

- **Monorepo Coordination**: Uses TypeScript project references for incremental builds and dependency management
- **Adapter Pattern**: Multiple language-specific adapter packages suggest a plugin architecture
- **Modern Module System**: Full ES modules with Node.js Next generation module resolution