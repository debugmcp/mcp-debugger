# packages/adapter-rust/vendor/
@generated: 2026-02-09T18:20:27Z

## Overall Purpose & Responsibility

The `vendor` directory serves as the complete distribution hub for CodeLLDB debugger runtimes, providing self-contained, platform-specific debugging environments that transform LLDB into a comprehensive IDE-integrated debugging platform. This directory houses complete CodeLLDB distributions across multiple architectures (darwin-arm64, darwin-x64, linux-arm64, linux-x64, win32-x64), each containing the full debugging stack required for advanced systems programming with specialized Rust support.

## Key Components & Unified Architecture

All vendor distributions implement a consistent three-tier integrated architecture:

### Platform-Specific Distributions (`codelldb/`)
Each platform directory contains:
- **Complete LLDB Debugging Engine**: Native breakpoints, stack traces, memory inspection with embedded Python 3.12 environment
- **Debug Adapter Protocol Layer**: Full DAP compliance for seamless VS Code integration with Python bootstrap system
- **Language Support Framework**: Dynamic plugin architecture with Rust-optimized debugging features and extensible language support

### Shared Component Architecture
Across all platforms:
- **Core LLDB Runtime**: Self-contained debugging engine with zero external dependencies
- **CodeLLDB Adapter**: DAP implementation with enhanced console, FFI communication bridge, and webview integration  
- **Plugin System**: Configuration-driven language support with graceful degradation and error isolation

## Component Integration & Data Flow

The vendor distributions operate through coordinated multi-platform deployment:

### Distribution Strategy
- **Platform Parity**: Identical API surface and debugging capabilities across all supported architectures
- **Self-Contained Packaging**: Complete debugging environments bundled with all required libraries and Python bindings
- **Zero-Dependency Deployment**: Consistent debugging experience regardless of host system configuration

### Runtime Integration
- **Unified Initialization**: VS Code launches platform-appropriate distribution, initializing LLDB with embedded Python
- **Language Discovery**: Automatic detection and loading of debugging enhancements based on project configuration
- **Session Coordination**: Seamless debugging session management across adapter, LLDB, and Python scripting layers

## Public API Surface & Entry Points

### Primary Integration Points

**Cross-Platform Debug Adapter Protocol**:
- Complete DAP implementation for standardized VS Code debugging operations
- Consistent debugging experience: breakpoints, stepping, variable inspection, expression evaluation

**Enhanced LLDB Console API**:
```python
# Standard initialization across all platform distributions
__lldb_init_module(debugger, internal_dict)

# Enhanced console capabilities
console.pip()  # In-debugger package management
```

**Unified Python Scripting Interface**:
```python
# CodeLLDB API access (consistent across platforms)
from codelldb import *

# Core debugging operations
evaluate(expr, unwrap=False)        # Expression evaluation
get_config(name, default=None)      # VS Code adapter integration
create_webview()                    # Interactive debugging panels
wrap(obj) / unwrap(obj)            # LLDB-Python value translation
```

**Language Plugin Framework**:
- Convention-based module loading requiring `__lldb_init_module` implementation
- Dynamic loading based on `sourceLanguages` with isolated error handling
- Extensible architecture supporting custom language-specific debugging features

## Internal Organization & Deployment Strategy

### Platform Distribution Model
- **Architecture-Specific Optimization**: Each distribution optimized for target platform while maintaining API consistency
- **Complete Environment Packaging**: Self-contained runtimes eliminate dependency management complexity
- **Deployment Flexibility**: Adapter automatically selects appropriate platform distribution at runtime

### Quality Assurance Patterns
- **Fail-Safe Architecture**: Component failures isolated to prevent system-wide debugging disruption
- **Graceful Degradation**: Non-essential feature failures do not compromise core debugging functionality
- **Cross-Platform Testing**: Consistent behavior verification across all supported architectures

## Key Patterns & Design Philosophy

**Platform Abstraction**: The vendor directory abstracts platform-specific implementation details while providing consistent debugging APIs and behavior across all supported architectures.

**Complete Distribution Strategy**: Each platform package is entirely self-contained, eliminating external dependencies and ensuring consistent debugging experiences across diverse development environments.

**Integrated Debugging Stack**: Seamless integration between native LLDB performance, VS Code IDE convenience, Python extensibility, and language-specific intelligence creates a comprehensive modern debugging platform.

**Rust-Optimized Focus**: While maintaining broad C/C++ compatibility, the distributions are specifically enhanced for advanced Rust debugging with specialized formatters, step-over behavior, and toolchain integration.

This vendor directory transforms the Rust debugging experience by providing complete, platform-optimized CodeLLDB distributions that bridge high-performance native debugging with modern IDE integration and extensive customization capabilities.