# packages/adapter-rust/src/index.ts
@source-hash: 4854f85903b60a77
@generated: 2026-02-10T00:41:20Z

**Primary Purpose**: Entry point module for the Rust Debug Adapter package, providing a unified interface to Rust debugging capabilities using CodeLLDB within the MCP Debugger framework.

**Key Exports**:
- `RustDebugAdapter` (L9): Core debug adapter class implementing Rust debugging functionality
- `RustAdapterFactory` (L10): Factory pattern implementation for creating Rust debug adapter instances
- `resolveCodeLLDBPath`, `checkCargoInstallation` (L11): Utility functions for managing CodeLLDB debugger and Cargo toolchain dependencies
- `resolveCargoProject`, `getCargoTargets` (L12): Cargo workspace and target resolution utilities
- `resolveCodeLLDBExecutable` (L13): CodeLLDB executable location resolver
- `detectBinaryFormat` (L14): Binary format detection utility for Rust executables
- `BinaryInfo` type (L15): TypeScript interface describing binary metadata structure

**Architecture**: Follows a modular design with clear separation of concerns - core adapter logic, factory pattern for instantiation, and specialized utilities for different aspects of Rust debugging (toolchain management, project resolution, binary analysis).

**Dependencies**: Built on ES modules (`.js` extensions) suggesting compilation from TypeScript. Relies on external CodeLLDB debugger and Cargo build system integration.

**Usage Pattern**: This module serves as the public API surface, exposing all necessary components for consumers to integrate Rust debugging capabilities into MCP-based debugging workflows.