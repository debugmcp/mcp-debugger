# packages/adapter-go/src/go-adapter-factory.ts
@source-hash: 913958a35b56d847
@generated: 2026-02-10T00:41:20Z

## Primary Purpose
Factory implementation for creating Go debug adapter instances. Implements dependency injection pattern through `IAdapterFactory` interface, providing environment validation and metadata for Go debugging capabilities using Delve debugger.

## Key Components

### GoAdapterFactory (L18-102)
Main factory class implementing `IAdapterFactory` interface with three core responsibilities:

- **createAdapter()** (L22-24): Creates new `GoDebugAdapter` instances with injected dependencies
- **getMetadata()** (L29-42): Returns static metadata including language info, file extensions (.go), version requirements (Go 1.18+, Delve 0.17.0+), and embedded Go gopher icon
- **validate()** (L47-101): Comprehensive environment validation checking Go/Delve installation, versions, and DAP support

### Dependencies
- `@debugmcp/shared`: Core interfaces (`IDebugAdapter`, `IAdapterFactory`, `AdapterDependencies`, `AdapterMetadata`, `FactoryValidationResult`, `DebugLanguage`)
- `./go-debug-adapter.js`: Concrete adapter implementation
- `./utils/go-utils.js`: Utility functions for executable discovery and version checking

## Validation Logic (L47-101)
Performs sequential checks:
1. **Go executable detection** (L56-68): Finds Go binary and validates version ≥1.18
2. **Delve validation** (L70-81): Locates dlv executable and verifies DAP protocol support
3. **Error aggregation**: Distinguishes between blocking errors and warnings

Returns structured result with validation status, error/warning messages, and system details (paths, versions, platform info).

## Architecture Patterns
- **Factory Pattern**: Encapsulates adapter creation logic
- **Dependency Injection**: Accepts external dependencies for adapter construction
- **Validation Strategy**: Environment pre-flight checks before adapter instantiation
- **Metadata Provider**: Static configuration for debugger integration

## Critical Constraints
- Requires Go 1.18+ for compatibility
- Delve must support DAP (Debug Adapter Protocol) mode
- Platform-agnostic design using process.platform/arch detection