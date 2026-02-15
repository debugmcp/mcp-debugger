# packages\mcp-debugger/
@children-hash: ff13a11ad53d4220
@generated: 2026-02-15T09:01:41Z

## Overall Purpose and Responsibility

The `packages/mcp-debugger` directory contains the complete MCP (Model Context Protocol) debugger CLI tool - a batteries-included debugging solution that enables interactive debugging of MCP servers across multiple programming languages. This module serves as both a standalone CLI application and a protocol-compliant MCP server, providing comprehensive debugging capabilities with bundled adapters for JavaScript, Python, Go, and mock testing scenarios.

## Key Components and Integration

### Build Infrastructure (`scripts/`)
- **bundle-cli.js**: Primary build orchestrator that transforms TypeScript sources into deployable CLI tools
- Creates ESM bundles with Node.js compatibility, executable wrappers, and npm-ready distribution packages
- Handles platform-specific debug adapter integration and graceful degradation for missing components
- Produces multiple artifact formats (bundles, packages, tarballs) for different deployment scenarios

### Core Application (`src/`)
- **cli-entry.ts**: Protocol-compliant CLI entry point with critical console silencing to prevent MCP protocol corruption
- **batteries-included.ts**: Global adapter registry system that ensures all debugging adapters are bundled in the final distribution
- Implements bootstrapping coordination and transport detection (stdio/SSE modes)

## Public API Surface

### Primary Entry Points
- **CLI Command**: Main npx-accessible debugger interface supporting multiple transport modes
- **Adapter Registry**: Global `__DEBUG_MCP_BUNDLED_ADAPTERS__` registry providing access to JavaScript, Python, Go, and Mock debugging adapters
- **Build Pipeline**: `bundleCLI()` function that produces complete distribution artifacts

### Supported Debugging Targets
- JavaScript/Node.js applications via js-debug adapter
- Python applications with specialized debugging capabilities  
- Go applications through integrated adapters
- Mock scenarios for testing and development
- Platform-specific native debugging (CodeLLDB) where available

## Internal Organization and Data Flow

### Build-to-Runtime Pipeline
1. **Development Phase**: TypeScript sources developed across multiple adapter packages
2. **Build Assembly**: Scripts bundle TypeScript sources, copy runtime assets, and integrate vendor adapters
3. **Distribution Generation**: Multiple output formats created (executable bundles, npm packages, platform-specific builds)
4. **Runtime Bootstrap**: CLI entry point establishes protocol compliance and populates adapter registry
5. **Debug Session**: Main application accesses bundled adapters for interactive debugging workflows

### Critical Architectural Patterns

**Batteries-Included Distribution**: All debugging adapters are statically bundled to eliminate runtime dependency issues and provide immediate debugging capabilities across multiple languages.

**Protocol Safety First**: Comprehensive stdout protection mechanisms ensure MCP protocol compliance by preventing console contamination during initialization and operation.

**Multi-Format Artifacts**: Single build process produces multiple consumption patterns - from direct CLI execution to npm package distribution to platform-specific bundles.

**Graceful Adaptation**: Missing platform-specific components generate warnings rather than failures, enabling partial builds and cross-platform compatibility.

## System Role and Dependencies

This module serves as the primary distribution mechanism for MCP debugging capabilities, consolidating distributed adapter packages into a cohesive, deployable CLI tool. It depends on pre-built adapter packages from the broader monorepo while providing the packaging and bootstrapping infrastructure necessary for end-user consumption.

The debugger acts as both a development tool for MCP server authors and a runtime component that can be embedded in debugging workflows, supporting both interactive CLI usage and programmatic integration scenarios.