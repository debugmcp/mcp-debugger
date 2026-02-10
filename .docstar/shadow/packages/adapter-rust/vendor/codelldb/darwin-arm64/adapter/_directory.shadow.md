# packages/adapter-rust/vendor/codelldb/darwin-arm64/adapter/
@generated: 2026-02-09T18:16:47Z

## Primary Purpose
This directory contains the complete CodeLLDB debugger adapter runtime for Darwin ARM64 systems. It serves as the platform-specific implementation of the CodeLLDB debugging ecosystem, providing enhanced LLDB debugging capabilities with rich Python scripting integration, VSCode UI components, and seamless Rust debugging support.

## Key Components & Architecture

### Core Structure
The adapter directory houses a comprehensive debugging runtime with the following primary component:

- **`scripts/` subdirectory**: Contains the Python scripting runtime and API layer that bridges LLDB's native functionality with CodeLLDB's enhanced debugging capabilities

### Integration Model
The directory implements a layered architecture:

1. **Platform Layer**: Darwin ARM64-specific adapter implementation
2. **Python Runtime Layer**: Comprehensive Python scripting environment (`scripts/`)
3. **LLDB Integration Layer**: Native LLDB functionality enhanced with custom commands and capabilities
4. **VSCode Interface Layer**: Rich UI integration through webview components

## Public API Surface

### Main Entry Points
- **LLDB Command Integration**: Automatic registration of enhanced debugging commands including package management (`pip`) within LLDB sessions
- **Python API Access**: Complete CodeLLDB API surface accessible through `debugger.py` entry point
- **Interactive Environment**: Enhanced Python REPL with debugging-specific utilities and LLDB integration

### Key Capabilities
- **Enhanced Value Inspection**: Python-friendly wrappers for LLDB values with operator overloading
- **Multi-Context Expression Evaluation**: Intelligent evaluation pipeline with fallback mechanisms
- **Rich Debugging Visualizations**: VSCode webview integration for advanced debugging UI
- **Rust-Python FFI Bridge**: Bidirectional communication between native Rust components and Python environment

## Internal Organization & Data Flow

### Runtime Initialization
1. LLDB automatically loads the console module during debugger startup
2. Custom commands and package management capabilities are registered
3. Full CodeLLDB API becomes available through the debugger entry point
4. Rust-Python FFI bridge establishes bidirectional communication channels

### Session Management
- DAP (Debug Adapter Protocol) compliance for VSCode integration
- Session state management with configuration access
- Message passing between debugging components and VSCode interface
- Comprehensive logging and error handling throughout the debugging pipeline

## Platform Context
This Darwin ARM64 adapter provides the complete CodeLLDB debugging experience on Apple Silicon systems. It enables sophisticated Rust debugging workflows in VSCode through enhanced LLDB Python scripting, with seamless integration between native debugging capabilities, rich Python tooling, and modern IDE interfaces. The adapter serves as the critical runtime component that transforms LLDB from a command-line debugger into a comprehensive, UI-rich debugging platform specifically optimized for Rust development.