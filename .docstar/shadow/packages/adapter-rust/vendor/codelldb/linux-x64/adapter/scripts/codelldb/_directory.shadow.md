# packages/adapter-rust/vendor/codelldb/linux-x64/adapter/scripts/codelldb/
@generated: 2026-02-09T18:16:17Z

## Overall Purpose

The `codelldb` directory provides the core Python scripting infrastructure for the CodeLLDB debugger adapter, enabling seamless integration between LLDB debugging functionality and VS Code IDE features. This module serves as the primary Python API layer that bridges Rust-based LLDB adapter backend with Python-based debugging scripts and VS Code webview interfaces.

## Key Components & Relationships

### Core API Layer (`api.py`)
- **Primary Entry Point**: Main public API providing high-level functions for debugger interaction
- **Configuration Management**: Hierarchical config access (`get_config()`) mapping dot-notation to VS Code settings
- **Expression Evaluation**: Simplified LLDB expression evaluation (`evaluate()`) with automatic value wrapping
- **Webview Integration**: VS Code panel creation (`create_webview()`) for rich debugging visualizations
- **Value Conversion**: Bidirectional wrapping/unwrapping between LLDB SBValue and Python Value objects

### Python-Rust FFI Bridge (`interface.py`)
- **Communication Backend**: Bidirectional FFI layer connecting Python scripts to Rust LLDB adapter
- **Session Management**: Debugger session lifecycle with stdout redirection and cleanup
- **Code Evaluation Engine**: Multi-context Python code compilation and execution within debugger scope
- **Message Handling**: DAP (Debug Adapter Protocol) message routing and event dispatching
- **Native Integration**: LLDB native expression evaluation with comprehensive fallback chains

### Value System (`value.py`)
- **Pythonic Wrapper**: Complete operator overloading for LLDB SBValue objects
- **Type Conversion**: Automatic conversion between LLDB types and Python primitives
- **Iterator Support**: Python iteration over LLDB container values
- **Expression Access**: Natural Python syntax for member and array access

### Event System (`event.py`)
- **Observer Pattern**: Simple event subscription/notification system
- **Synchronous Delivery**: Sequential listener notification for deterministic behavior

### Command Extension (`commands/`)
- **LLDB Command Integration**: Custom LLDB commands for enhanced debugging capabilities

## Public API Surface

### Main Entry Points
- `api.get_config(name, default)` - Configuration access
- `api.evaluate(expr, unwrap=True)` - Expression evaluation  
- `api.create_webview()` - VS Code webview creation
- `api.wrap(obj)` / `api.unwrap(obj)` - Value conversion utilities
- `api.debugger_message(output, category)` - Console messaging

### Value Manipulation
- `Value` class with full operator overloading (arithmetic, comparison, indexing)
- `get_value(v)` - Extract Python primitives from Value objects
- Automatic type detection and conversion for numeric/string types

### Session Integration
- Module initialization via `__lldb_init_module()` hook
- Session lifecycle management through `interface.session_init/deinit()`
- DAP message handling and event propagation

## Internal Organization & Data Flow

### Execution Flow
1. **Initialization**: Module loaded via LLDB, registers commands and FFI callbacks
2. **Session Setup**: Per-debugger session initialization with context management
3. **Expression Evaluation**: Multi-layered evaluation with context switching (SimpleExpression → PythonExpression → Statement)
4. **Value Processing**: Automatic wrapping/unwrapping through Value proxy objects
5. **UI Communication**: Webview creation and DAP message routing to VS Code

### Data Flow Patterns
- **Hierarchical Configuration**: VSCode settings → adapter settings → script config access
- **Value Pipeline**: LLDB SBValue → Value wrapper → Python operations → back to SBValue
- **Event Propagation**: Python events → Rust adapter → DAP protocol → VS Code UI
- **Context Management**: Global execution context tracking with proper cleanup

## Important Patterns & Conventions

### Architecture Patterns
- **Facade Pattern**: `api.py` provides simplified interface over complex LLDB/FFI internals
- **Proxy Pattern**: `Value` class transparently wraps SBValue with Python semantics
- **Observer Pattern**: Event system for decoupled component communication
- **FFI Bridge**: Comprehensive ctypes-based Python-Rust interoperability

### Critical Invariants
- Single debugger context maintained globally during evaluation
- SWIG object ownership properly managed to prevent memory leaks
- Value wrapper idempotency (wrapping wrapped objects returns same object)
- Session cleanup ensures proper stdout restoration and resource deallocation

### Error Handling
- Result-type enums for Rust FFI error propagation
- Graceful fallbacks in native expression evaluation
- Exception safety in event listener chains
- Deprecation warnings for API migration