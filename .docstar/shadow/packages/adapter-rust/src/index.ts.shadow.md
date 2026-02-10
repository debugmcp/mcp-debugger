# packages/adapter-rust/src/index.ts
@source-hash: 4854f85903b60a77
@generated: 2026-02-09T18:14:28Z

**Purpose**: Entry point module for the @debugmcp/adapter-rust package, which provides Rust debugging capabilities through CodeLLDB integration for the MCP Debugger ecosystem.

**Architecture**: This is a pure re-export module that consolidates the package's public API from various internal modules, following a barrel export pattern for clean package boundaries.

**Key Exports**:
- `RustDebugAdapter` (L9): Core debug adapter implementation for Rust debugging sessions
- `RustAdapterFactory` (L10): Factory class for creating configured Rust debug adapter instances
- `resolveCodeLLDBPath`, `checkCargoInstallation` (L11): Utility functions for CodeLLDB discovery and Cargo environment validation
- `resolveCargoProject`, `getCargoTargets` (L12): Cargo workspace analysis and target enumeration utilities
- `resolveCodeLLDBExecutable` (L13): CodeLLDB executable resolution logic
- `detectBinaryFormat`, `BinaryInfo` (L14-15): Binary format detection utilities and type definitions

**Dependencies**: Imports from 5 internal modules:
- `./rust-debug-adapter.js` - Main adapter implementation
- `./rust-adapter-factory.js` - Adapter factory
- `./utils/rust-utils.js` - Rust toolchain utilities  
- `./utils/cargo-utils.js` - Cargo project utilities
- `./utils/codelldb-resolver.js` - CodeLLDB resolution
- `./utils/binary-detector.js` - Binary analysis utilities

**Design Pattern**: Implements the facade pattern, providing a single entry point to access all package functionality while maintaining internal module organization.