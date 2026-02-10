# packages/adapter-rust/vendor/codelldb/linux-arm64/adapter/scripts/debugger.py
@source-hash: 2ae4e9964c6b0b7d
@generated: 2026-02-09T18:12:32Z

**Primary Purpose**: Entry point module for CodeLLDB debugger adapter that imports all core debugging functionality.

**Key Components**:
- Wildcard import from `codelldb` module (L1) - Brings all debugging classes, functions, and constants into the global namespace

**Dependencies**:
- `codelldb` module - Core debugging adapter implementation containing LLDB integration, breakpoint management, variable inspection, and debugging session control

**Architectural Context**:
This is a minimal bootstrap script that serves as the main entry point for the CodeLLDB debugger adapter on Linux ARM64 architecture. The wildcard import pattern suggests this file acts as a convenient namespace aggregator, making all debugging functionality immediately available to clients or other scripts that import from this module.

**Critical Notes**:
- Single-line implementation indicates the real functionality resides in the imported `codelldb` module
- Platform-specific location (`linux-arm64`) suggests architecture-aware deployment structure
- The wildcard import may expose a large API surface area for debugging operations