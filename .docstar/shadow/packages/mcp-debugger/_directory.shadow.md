# packages/mcp-debugger/
@generated: 2026-02-10T01:19:48Z

## Overall Purpose

The `packages/mcp-debugger` directory serves as the standalone CLI distribution package for the MCP debugger system. This module transforms the core debugger implementation into a self-contained, distributable tool that can be installed via npm and executed independently while maintaining full MCP protocol compliance and adapter ecosystem integration.

## Key Components and Integration

### Build System (`scripts/`)
The build automation layer that orchestrates the complete packaging pipeline:
- **Bundle Orchestration**: Compiles TypeScript sources to production-ready distributions with embedded dependencies
- **Vendor Integration**: Packages platform-specific debug adapters (JavaScript via js-debug, Rust via CodeLLDB)
- **Distribution Management**: Creates npm-ready packages with proper executable wrappers and cross-platform compatibility

### CLI Runtime (`src/`)
The runtime distribution layer providing protocol-compliant entry points:
- **Adapter Bundle Management**: Pre-registers all supported adapters (JavaScript, Python, Mock) via global registry pattern
- **Protocol Compliance**: Ensures MCP transport compatibility through careful console management and initialization ordering
- **Entry Point Coordination**: Manages CLI bootstrap process with proper flag coordination and error handling

## Public API Surface

### Primary Entry Points
- **CLI Executable**: `cli-entry.ts` - Main entry point for `npx @debugmcp/debugger` usage
- **Distribution Package**: `debugmcp-*.tgz` - Standalone npm package with all runtime dependencies

### Key Interfaces
- **Global Adapter Registry**: `__DEBUG_MCP_BUNDLED_ADAPTERS__` - Discoverable adapter collection for runtime
- **Build Pipeline**: `bundleCLI()` function for packaging workflows
- **Environment Coordination**: Protocol compliance flags and initialization control

## Internal Organization and Data Flow

1. **Build Phase**: Scripts directory transforms development artifacts into production bundles with selective dependency inclusion
2. **Runtime Initialization**: CLI entry point manages console silencing and adapter loading before delegating to core implementation  
3. **Adapter Discovery**: Global registry pattern enables loose coupling between bundled adapters and main debugger system
4. **Protocol Enforcement**: Careful ordering ensures MCP transport compliance through stdout management

## Important Patterns and Conventions

### Protocol-First Architecture
Prioritizes MCP protocol compliance over developer convenience, with mandatory console management for transport modes and strict initialization ordering.

### Global Registry System
Uses global namespace pattern for adapter discovery, enabling static bundling while maintaining runtime flexibility and preventing duplicate registrations.

### Defensive Distribution
Employs platform-aware builds, graceful degradation for missing components, and cross-platform executable generation for robust distribution.

### Build-Runtime Separation
Clean separation between build-time bundling concerns and runtime execution, allowing independent optimization of each phase.

This directory serves as the complete distribution solution for the MCP debugger, transforming the core implementation into a standalone, protocol-compliant CLI tool that can be easily distributed and executed across platforms while maintaining full adapter ecosystem support.