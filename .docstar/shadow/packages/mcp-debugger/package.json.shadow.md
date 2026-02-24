# packages\mcp-debugger\package.json
@source-hash: cfcd7c698dab7ff1
@generated: 2026-02-24T01:54:04Z

## Package Configuration for MCP Debugger CLI

Main package.json for the MCP (Model Context Protocol) debugger - a step-through debugging server for LLMs. This is an ES module package that provides a CLI binary for debugging MCP servers.

**Key Configuration:**
- Package name: `@debugmcp/mcp-debugger` (L2)
- Version: 0.18.0 (L3) 
- CLI binary: `mcp-debugger` executable at `./dist/cli` (L13-15)
- ES module type with Node.js >=18 requirement (L12, L21-23)
- MIT licensed with public npm access (L11, L29-31)

**Build System:**
- Custom build script using `scripts/bundle-cli.js` (L25-26)
- Clean script removes dist and TypeScript build info (L27)
- Published files include only dist, README, and LICENSE (L16-20)

**Dependencies:**
- No runtime dependencies - self-contained CLI (L32)
- Dev dependencies include workspace-linked debugger adapters for multiple languages:
  - Go, JavaScript, Python, Rust adapters (L34-38)
  - Mock adapter for testing (L37)
  - Shared utilities package (L39)

**Architecture Notes:**
- Monorepo structure with workspace dependencies
- Language-agnostic debugging through adapter pattern
- Distribution as standalone binary with bundled dependencies
- Repository hosted on GitHub with directory-specific packaging (L6-10)