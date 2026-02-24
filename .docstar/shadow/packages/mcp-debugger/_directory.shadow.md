# packages\mcp-debugger/
@children-hash: 9e4c9d5466342440
@generated: 2026-02-24T01:54:56Z

## Overall Purpose and Responsibility

The `mcp-debugger` package provides a complete, standalone CLI tool for step-through debugging of MCP (Model Context Protocol) servers across multiple programming languages. This module serves as the primary distribution point for a "batteries-included" debugging solution that bundles all necessary adapters and maintains strict MCP protocol compliance.

## Key Components and Integration

### Core Application Infrastructure
- **CLI Entry Point** (`src/cli-entry.ts`): Protocol-safe bootstrapping that silences console output before any imports to prevent MCP protocol corruption
- **Adapter Bundling System** (`src/batteries-included.ts`): Global registry that statically includes all debugging adapters (JavaScript, Python, Go, Mock) in the final distribution
- **Build Orchestration** (`scripts/bundle-cli.js`): Production build pipeline that assembles multi-component CLI bundles with platform-specific vendor adapters

### Distribution and Packaging
- **NPM Package Configuration**: Self-contained ES module with no runtime dependencies, published as `@debugmcp/mcp-debugger`
- **TypeScript Build System**: Composite project setup with incremental compilation and declaration file generation
- **Multi-Artifact Generation**: Creates bundles, npm packages, and tarballs for different deployment scenarios

## Public API Surface

### Primary Entry Points
- **`mcp-debugger` CLI Command**: Main executable accessible via npx, supporting stdio/SSE transport modes
- **Global Adapter Registry**: `__DEBUG_MCP_BUNDLED_ADAPTERS__` provides access to all bundled debugging adapters
- **Build Pipeline**: `bundleCLI()` function orchestrates complete artifact generation

### Supported Debugging Targets
- JavaScript/Node.js applications via js-debug adapter
- Python applications via Python adapter  
- Go applications via CodeLLDB adapter
- Mock/testing scenarios via Mock adapter

## Internal Organization and Data Flow

### CLI Execution Flow
1. **Bootstrap Phase**: `cli-entry.ts` immediately silences console output based on transport detection
2. **Adapter Loading**: Static imports populate the global adapter registry with all available debuggers
3. **Main Delegation**: Dynamic import prevents premature loading while maintaining protocol safety
4. **Runtime Debugging**: Core implementation accesses bundled adapters for cross-language debugging

### Build and Distribution Pipeline
1. **Source Compilation**: TypeScript sources bundled into optimized ESM format with Node.js compatibility
2. **Asset Assembly**: Runtime components and vendor adapters copied from workspace packages
3. **Package Generation**: npm-compatible structure created with proper entry points and metadata
4. **Artifact Finalization**: Multiple output formats (standalone, package, tarball) generated for different use cases

## Important Patterns and Conventions

**Protocol Safety First**: All console operations carefully managed to maintain MCP protocol compliance, with immediate silencing before any module imports.

**Batteries-Included Distribution**: Complete debugging solution bundled as single CLI tool, eliminating external dependency management for end users.

**Graceful Platform Handling**: Optional platform-specific components (like CodeLLDB) included when available but don't break builds when missing.

**Workspace Integration**: Leverages monorepo structure for adapter development while producing standalone distribution artifacts.

This package serves as the primary end-user interface to the MCP debugging ecosystem, transforming a complex multi-package development environment into a simple, installable CLI tool that "just works" across different programming languages and deployment scenarios.