# packages/adapter-go/src/
@generated: 2026-02-09T18:16:23Z

## Purpose
The `packages/adapter-go/src` directory implements a complete Go debugging solution for the mcp-debugger system, providing seamless integration with Delve (dlv) debugger through the VS Code Debug Adapter Protocol. This module serves as a production-ready adapter that enables Go program debugging with comprehensive environment validation, tool discovery, and native DAP protocol support.

## Architecture Overview

### Core Components Relationship
The module follows a layered architecture with clear separation of concerns:

1. **Entry Point** (`index.ts`): Barrel export module that aggregates all functionality and provides standardized interface for mcp-debugger's dynamic loading system
2. **Factory Layer** (`go-adapter-factory.ts`): Implements adapter creation with comprehensive environment validation
3. **Adapter Implementation** (`go-debug-adapter.ts`): Core debugging logic using Delve's native DAP support
4. **Utilities Foundation** (`utils/`): Cross-platform Go toolchain discovery and management

### Data Flow
```
mcp-debugger loader → index.ts → GoAdapterFactory → Environment Validation (utils) → GoDebugAdapter → Delve DAP
```

## Public API Surface

### Main Entry Points
- **Default Export**: Standardized adapter configuration object with dynamic factory loading for mcp-debugger integration
- **`GoAdapterFactory`**: Primary factory class implementing `IAdapterFactory` with environment validation capabilities
- **`GoDebugAdapter`**: Core adapter class implementing `IDebugAdapter` interface for debug session management
- **Go Utilities**: Re-exported toolchain discovery and validation functions

### Factory Interface
- `createAdapter()`: Instantiates debug adapter with dependency injection
- `getMetadata()`: Returns Go language metadata, version info, and visual assets
- `validate()`: Comprehensive async environment validation for Go 1.18+ and Delve DAP support

### Adapter Interface  
- `validateEnvironment()`: Runtime environment checking with detailed error reporting
- `transformLaunchConfig()`: Go-specific configuration transformation
- `getCapabilities()`: Comprehensive DAP feature declaration (conditional breakpoints, variable evaluation, etc.)
- `supportsFeature()`: Debug feature capability queries

## Internal Organization

### Environment Management Strategy
The module implements a sophisticated multi-tier approach:
1. **Discovery Phase**: Cross-platform executable location using PATH, GOPATH, and common install directories
2. **Validation Phase**: Version compatibility checking (Go 1.18+, Delve 0.17.0+)
3. **Capability Phase**: DAP protocol support verification
4. **Caching Layer**: Performance optimization with 60-second executable path caching

### Debug Session Lifecycle
1. **Initialization**: Factory validates environment and creates adapter instance
2. **Configuration**: Launch config transformation to Go-specific parameters
3. **Connection**: Delve DAP server spawn and protocol negotiation  
4. **Runtime**: Event forwarding and state management between DAP and VS Code protocol
5. **Termination**: Clean session shutdown and resource cleanup

## Key Patterns and Conventions

### Factory Pattern Implementation
- Standardized `IAdapterFactory` interface compliance
- Dependency injection for testability
- Comprehensive validation with structured error reporting

### Error Handling Strategy
- Graceful degradation with informative error messages
- Platform-specific installation instructions
- Distinguishes between recoverable warnings and blocking errors

### Caching Architecture
- Separate caches for Go and Delve executables
- Timestamp-based cache invalidation (60-second timeout)
- Version information cached within path entries

### Cross-Platform Compatibility
- Windows executable suffix handling (.exe)
- Platform-aware search paths and environment variables
- Consistent path manipulation across operating systems

## Integration Points
The module serves as a bridge between:
- **mcp-debugger system** and Go-specific debugging requirements
- **VS Code Debug Protocol** and Delve's native DAP implementation  
- **Cross-platform environments** and Go toolchain discovery
- **User configurations** and Delve command-line parameters

This adapter enables full-featured Go debugging including conditional breakpoints, variable inspection, goroutine management, and comprehensive stack trace analysis through a unified debugging interface.