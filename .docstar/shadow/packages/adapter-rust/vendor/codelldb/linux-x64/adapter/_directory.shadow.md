# packages/adapter-rust/vendor/codelldb/linux-x64/adapter/
@generated: 2026-02-09T18:16:54Z

## Overall Purpose
The `adapter` directory serves as the complete CodeLLDB debugger adapter runtime environment, providing the executable adapter binary and comprehensive Python scripting infrastructure. This directory contains everything needed to run the CodeLLDB adapter as a standalone debugger backend, including the core adapter executable and full Python API layer for extended debugging capabilities.

## Key Components & Architecture

### Runtime Components
- **Adapter Binary**: Core debugger adapter executable that implements the Debug Adapter Protocol (DAP) and manages LLDB integration
- **Python Scripts Environment** (`scripts/`): Complete Python scripting infrastructure that extends LLDB with CodeLLDB-specific functionality

### Integration Model
The directory implements a dual-layer architecture:
1. **Native Adapter Layer**: Binary executable handling DAP communication, debugger lifecycle, and low-level LLDB operations
2. **Python Extension Layer**: Comprehensive scripting environment providing high-level APIs, interactive enhancements, and VS Code integration features

## Public API Surface

### Primary Entry Points
- **Adapter Binary**: Main executable for Debug Adapter Protocol communication with VS Code or other debugging clients
- **Python API Access**: 
  - `scripts/debugger.py` - Complete CodeLLDB API access point (`from codelldb import *`)
  - Enhanced LLDB console with custom commands and package management
  - Programmatic access to configuration, expression evaluation, and webview integration

### Key Capabilities
- **Full DAP Implementation**: Complete Debug Adapter Protocol support for VS Code integration
- **Extended LLDB Console**: Interactive debugging with custom commands (`pip`) and CodeLLDB extensions
- **Rich API Layer**: Python-Rust FFI bridge providing Pythonic access to adapter functionality
- **Development Tools**: Runtime package management, expression evaluation, and debugging visualizations

## Internal Organization & Data Flow

### Runtime Architecture
1. **Adapter Startup**: Binary executable initializes LLDB backend and DAP communication channels
2. **Python Environment**: Scripts directory provides enhanced LLDB console and API layer
3. **Bidirectional Communication**: Python-Rust FFI enables seamless integration between scripting layer and native adapter

### Component Relationships
- **Adapter ↔ Scripts**: Binary adapter exposes functionality through Python FFI bridge
- **Scripts ↔ LLDB**: Python layer extends LLDB with custom commands and enhanced capabilities  
- **API Unification**: Single entry point (`debugger.py`) provides access to complete CodeLLDB functionality
- **Console Integration**: Enhanced LLDB console with package management and custom debugging tools

## Critical Responsibilities
- **Debugger Backend**: Complete debugging backend implementation with DAP protocol support
- **API Provisioning**: Comprehensive Python API for scripting, automation, and custom debugging tools
- **Environment Management**: Self-contained runtime with package management and dependency handling
- **VS Code Integration**: Seamless integration with VS Code debugging features including webviews and rich visualizations
- **Extensibility Platform**: Foundation for custom debugging scripts, tools, and workflow automation

## Usage Contexts
This directory supports multiple deployment and usage scenarios:
- **VS Code Extension**: Primary adapter backend for CodeLLDB VS Code extension
- **Standalone Debugging**: Independent DAP-compatible debugger for various clients
- **Interactive Development**: Enhanced LLDB console for manual debugging and exploration
- **Automation & Scripting**: Platform for automated debugging workflows and custom tools
- **Development Environment**: Complete debugging toolkit with package management and extensibility