# packages/adapter-rust/vendor/codelldb/darwin-x64/adapter/
@generated: 2026-02-09T18:16:52Z

## Purpose

This directory contains the core CodeLLDB debugger adapter implementation for Darwin x64 systems. It provides a complete debugging solution that bridges LLDB's native debugging capabilities with VS Code's Debug Adapter Protocol, enabling advanced C/C++/Rust debugging with rich Python scripting support and HTML-based custom UIs.

## Key Components & Architecture

The adapter follows a multi-layered architecture that combines native debugging capabilities with extensible scripting:

### Core Components
- **Native Adapter**: The main debugger adapter executable that implements the Debug Adapter Protocol for communication with VS Code
- **Python Scripting Layer**: A comprehensive Python environment (`scripts/`) that extends LLDB with custom commands, value inspection, and UI capabilities
- **FFI Bridge**: Rust-Python communication layer enabling bidirectional messaging between the native adapter and Python scripts

### Component Integration
The components work together to provide a seamless debugging experience:

1. **VS Code Integration**: The adapter communicates with VS Code using the Debug Adapter Protocol
2. **LLDB Extension**: Python scripts are loaded into LLDB's embedded interpreter to provide enhanced functionality
3. **Custom UI Framework**: HTML-based webviews enable rich debugging interfaces beyond standard VS Code debugging panels
4. **Configuration System**: Hierarchical settings management bridges VS Code configuration with debugger behavior

## Public API Surface

### Primary Entry Points
- **Debug Adapter Protocol**: Standard DAP interface for VS Code integration
- **Python Scripting API**: Complete API for custom debugging scripts including:
  - Expression evaluation with LLDB context
  - Value inspection with operator overloading
  - Custom command registration (`pip` package management, etc.)
  - Webview creation for HTML-based UIs
  - Bidirectional messaging with VS Code

### Extension Points
- **Custom Commands**: LLDB command extensions that integrate seamlessly with VS Code
- **Value Formatters**: Python-based value visualization and inspection
- **UI Components**: HTML/JavaScript-based debugging interfaces
- **Session Lifecycle**: Hooks for debugging session initialization and cleanup

## Internal Organization

### Data Flow
1. VS Code initiates debugging sessions through the Debug Adapter Protocol
2. The native adapter manages LLDB debugging sessions and process control
3. Python scripts extend LLDB capabilities and provide custom functionality
4. FFI communication enables real-time coordination between all layers
5. Custom UIs and commands provide enhanced debugging experiences

### Communication Patterns
- **DAP Communication**: JSON-RPC protocol for VS Code integration
- **FFI Bridge**: Type-safe Rust-Python interoperability using ctypes
- **Event System**: Observer pattern for decoupled component communication
- **Context Management**: Proper LLDB context handling during script execution

## Important Patterns

- **Protocol Compliance**: Full Debug Adapter Protocol implementation for VS Code compatibility
- **Extensible Architecture**: Python scripting layer allows for custom debugging workflows
- **Resource Management**: Careful lifecycle management of debugging sessions, processes, and resources
- **Type Safety**: Comprehensive type mapping between LLDB, Python, and Rust systems
- **Standard Integration**: Follows VS Code and LLDB conventions for seamless user experience

This adapter transforms LLDB into a VS Code-integrated debugging platform that maintains full access to native debugging capabilities while providing modern IDE features and extensibility through Python scripting.