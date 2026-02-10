# packages/adapter-rust/src/rust-adapter-factory.ts
@source-hash: 2ee8e39e11353a9d
@generated: 2026-02-10T00:41:26Z

## Rust Debug Adapter Factory

**Purpose**: Factory class responsible for creating Rust debug adapter instances and validating the Rust debugging environment. Implements the adapter factory pattern for dependency injection in the MCP debugger ecosystem.

### Key Components

**RustAdapterFactory (L17-93)**: Main factory class implementing `IAdapterFactory` interface
- `createAdapter(dependencies)` (L21-23): Creates new RustDebugAdapter instances with injected dependencies
- `getMetadata()` (L28-40): Returns adapter metadata including language info, version, supported extensions (.rs), and CodeLLDB integration details
- `validate()` (L45-92): Comprehensive environment validation checking CodeLLDB availability, Cargo installation, and Rust toolchain compatibility

### Dependencies & Architecture

**External Dependencies**:
- `@debugmcp/shared`: Core interfaces (IDebugAdapter, IAdapterFactory, AdapterDependencies, AdapterMetadata, FactoryValidationResult, DebugLanguage)
- `./rust-debug-adapter.js`: Concrete adapter implementation
- `./utils/rust-utils.js`: Rust toolchain utilities (checkCargoInstallation, getCargoVersion, getRustHostTriple)
- `./utils/codelldb-resolver.js`: CodeLLDB debugger utilities (resolveCodeLLDBExecutable, getCodeLLDBVersion)

### Validation Logic

**Environment Checks (L45-92)**:
- **CodeLLDB availability** (L54-60): Critical dependency - errors if not found, suggests build command
- **Cargo installation** (L63-68): Optional but recommended - warnings if missing with installation guidance
- **Toolchain compatibility** (L70-76): Detects Windows MSVC vs GNU toolchain, warns about potential DWARF debug info issues

**Validation Result Structure** (L78-91):
- `valid`: Boolean based on absence of errors
- `errors`: Blocking issues (missing CodeLLDB)
- `warnings`: Non-blocking issues (missing Cargo, suboptimal toolchain)
- `details`: Environment snapshot including paths, versions, platform info, timestamp

### Architectural Patterns

- **Factory Pattern**: Clean separation of adapter creation from configuration
- **Dependency Injection**: Accepts dependencies for flexible testing and configuration
- **Environment Validation**: Proactive checking of debugging prerequisites
- **Platform Awareness**: Handles Windows MSVC vs GNU toolchain differences

### Critical Constraints

- CodeLLDB is mandatory for functionality (error condition)
- Supports only `.rs` file extensions
- Optimized for GNU toolchain on Windows (MSVC generates warnings)
- Version constraints: minimum debugger version 1.0.0