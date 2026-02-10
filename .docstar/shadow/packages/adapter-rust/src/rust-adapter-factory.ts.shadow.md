# packages/adapter-rust/src/rust-adapter-factory.ts
@source-hash: 2ee8e39e11353a9d
@generated: 2026-02-09T18:14:33Z

## Primary Purpose
Factory class for creating Rust debug adapter instances with environment validation and metadata provision. Implements the adapter factory pattern for dependency injection in the debugger framework.

## Key Classes & Functions

### RustAdapterFactory (L17-92)
Main factory class implementing `IAdapterFactory` interface.

**Key Methods:**
- `createAdapter(dependencies)` (L21-23): Creates new `RustDebugAdapter` instance with provided dependencies
- `getMetadata()` (L28-40): Returns static adapter metadata including language info, file extensions (.rs), version (0.1.0), and base64-encoded Rust icon
- `validate()` (L45-92): Async validation of runtime environment checking CodeLLDB and Cargo availability

## Dependencies & Relationships
- **Core Dependencies**: `@debugmcp/shared` for interfaces (`IDebugAdapter`, `IAdapterFactory`, adapter types)
- **Adapter Creation**: Creates `RustDebugAdapter` instances from local module
- **Utility Integration**: Uses `rust-utils.js` for Cargo/Rust toolchain validation and `codelldb-resolver.js` for debugger executable resolution

## Validation Logic (L45-92)
Environment validation performs:
1. **CodeLLDB Check**: Resolves executable path, reports error if missing
2. **Cargo Check**: Validates Rust toolchain installation, reports warning if missing
3. **Host Triple Detection**: Identifies target platform, warns about MSVC toolchain compatibility issues
4. **Result Aggregation**: Returns validation status with errors/warnings and detailed environment info

## Configuration & Metadata
- **Language**: `DebugLanguage.RUST` 
- **File Extensions**: `.rs` files only
- **Debugger**: Uses CodeLLDB as underlying debug engine
- **Platform Awareness**: Detects Windows MSVC vs GNU toolchain differences

## Architectural Patterns
- **Factory Pattern**: Clean instantiation of debug adapters
- **Dependency Injection**: Accepts external dependencies for adapter construction  
- **Validation Strategy**: Comprehensive environment checking before adapter creation
- **Metadata Provider**: Static configuration data for UI/registration purposes