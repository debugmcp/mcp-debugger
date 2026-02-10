# packages/adapter-go/
@generated: 2026-02-09T18:16:38Z

## Purpose
The `packages/adapter-go` module provides a complete Go debugging adapter for the mcp-debugger system, enabling seamless integration with the Delve (dlv) debugger through the VS Code Debug Adapter Protocol. This production-ready package serves as a specialized language adapter that bridges the gap between VS Code's debugging interface and Go's native debugging capabilities.

## Architecture Overview

### Component Integration
The module implements a clean factory pattern architecture with three primary layers:

1. **Entry Point Layer**: The `src/index.ts` serves as a barrel export module providing standardized interfaces for the mcp-debugger's dynamic loading system
2. **Factory Layer**: `GoAdapterFactory` handles adapter instantiation with comprehensive environment validation
3. **Runtime Layer**: `GoDebugAdapter` manages active debugging sessions using Delve's native DAP support
4. **Utilities Foundation**: Cross-platform Go toolchain discovery and management utilities

### System Integration Flow
```
mcp-debugger → Go Adapter Factory → Environment Validation → Go Debug Adapter → Delve DAP Server
```

## Public API Surface

### Main Entry Points
- **Default Export**: Standardized adapter configuration object compatible with mcp-debugger's dynamic loading mechanism
- **`GoAdapterFactory`**: Primary factory implementing `IAdapterFactory` for adapter creation and environment validation
- **`GoDebugAdapter`**: Core adapter class implementing `IDebugAdapter` for debug session management

### Key Factory Methods
- `createAdapter()`: Instantiates debug adapter with dependency injection
- `getMetadata()`: Provides Go language metadata, version information, and visual assets  
- `validate()`: Performs comprehensive async environment validation (Go 1.18+, Delve DAP support)

### Core Adapter Capabilities
- `validateEnvironment()`: Runtime environment verification with detailed error reporting
- `transformLaunchConfig()`: Go-specific debug configuration transformation
- `getCapabilities()`: Declares comprehensive DAP features (conditional breakpoints, variable evaluation, goroutine management)
- `supportsFeature()`: Dynamic feature capability queries

## Internal Organization

### Environment Management Strategy
The module implements a sophisticated multi-phase validation approach:
- **Discovery**: Cross-platform executable location via PATH, GOPATH, and standard installation directories
- **Validation**: Version compatibility verification (Go 1.18+, Delve 0.17.0+)
- **Capability Assessment**: DAP protocol support confirmation
- **Performance Optimization**: 60-second executable path caching for improved startup times

### Debug Session Lifecycle
1. Factory validates Go environment and toolchain availability
2. Adapter transforms user configurations to Delve-compatible parameters
3. Delve DAP server spawning and protocol negotiation
4. Event forwarding between DAP and VS Code Debug Protocol
5. Clean session termination and resource cleanup

## Key Design Patterns

### Factory Pattern Implementation
- Standardized `IAdapterFactory` interface compliance for mcp-debugger integration
- Dependency injection architecture for enhanced testability
- Comprehensive validation with structured error reporting and recovery guidance

### Cross-Platform Compatibility
- Windows executable suffix handling (.exe)
- Platform-aware search paths and environment variables
- Consistent path manipulation across operating systems

### Error Handling & User Experience
- Graceful degradation with informative error messages
- Platform-specific installation instructions
- Clear distinction between recoverable warnings and blocking errors

## Integration Role
This adapter serves as a critical bridge between:
- The mcp-debugger system and Go-specific debugging requirements
- VS Code's Debug Protocol and Delve's native DAP implementation
- Cross-platform environments and Go toolchain discovery
- User debug configurations and Delve's command-line interface

The module enables comprehensive Go debugging features including conditional breakpoints, variable inspection, goroutine management, stack trace analysis, and real-time code evaluation through a unified, IDE-agnostic debugging interface.