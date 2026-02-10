# packages/shared/
@generated: 2026-02-10T21:27:10Z

## Purpose
The `packages/shared` directory serves as the foundational shared library for a multi-language Model Context Protocol (MCP) debugger system. It provides the core abstractions, interfaces, and infrastructure that enable language-specific debug adapters to integrate seamlessly with VS Code's Debug Adapter Protocol (DAP) while maintaining consistent behavior across multiple programming languages (JavaScript, Python, Java, Rust, Go).

## Architecture and Component Integration

### Core Module Structure
- **`src/`**: Complete foundational library with layered architecture
  - **Interfaces Layer**: Core debug adapter contracts (`IDebugAdapter`), policy-based architecture (`AdapterPolicy`), and registry system
  - **Factory Infrastructure**: Standardized adapter creation with validation and version compatibility
  - **Data Models**: Session management, runtime representations, and configuration systems
- **`tests/`**: Comprehensive unit test suite validating DAP compliance and cross-platform compatibility
- **`vitest.config.ts`**: Test infrastructure configuration with Istanbul coverage reporting

### Component Integration Flow
1. **Registration**: Language adapters register policies and factories with the central registry system
2. **Discovery**: Debug clients query the registry for available languages and debugging capabilities  
3. **Instantiation**: Factories create language-specific adapters with dependency injection and validation
4. **Execution**: DAP requests flow through policy-filtered handlers with multi-session coordination
5. **Testing**: Comprehensive validation ensures protocol compliance and cross-platform robustness

### Architectural Patterns
- **Interface Segregation**: Clean separation between abstractions and implementations
- **Policy-Based Design**: Pluggable language-specific behaviors while maintaining unified transport
- **Factory/Registry Pattern**: Centralized adapter discovery, creation, and lifecycle management
- **Dependency Injection**: Complete abstraction of system resources for testability
- **Event-Driven Architecture**: Async state management with performance targets

## Public API Surface

### Primary Entry Points
- **`IDebugAdapter`**: Main interface for implementing language-specific debug adapters
- **`IAdapterRegistry` & `IAdapterFactory`**: Adapter registration and creation system
- **`AdapterPolicy`**: Language-specific behavior customization interface
- **`DebugSession`**: Complete session state management with dual-state architecture
- **Configuration Types**: Generic launch/attach configurations with language extensions

### Core Type System
- **`DebugLanguage`**: Enumeration of supported programming languages
- **`SessionLifecycleState` & `ExecutionState`**: Modern dual-state management system
- **`DebugFeature`**: Capability declarations for feature negotiation
- **Utility Functions**: Type guards, state mapping, and version compatibility helpers

### Data Models
- **Runtime Artifacts**: Variable, StackFrame, BreakPoint representations
- **Session Management**: DebugSessionInfo with lifecycle and execution state tracking
- **Legacy Compatibility**: Bidirectional state mapping for gradual modernization

## System Coordination

### Multi-Language Support
The module enables a **unified debugging experience** across different programming languages by:
- Providing standardized interfaces that language adapters implement
- Abstracting DAP protocol complexities through policy-based customization
- Coordinating multi-session debugging scenarios (e.g., JavaScript parent-child processes)
- Ensuring consistent state management and event propagation

### Quality Assurance
Comprehensive testing infrastructure validates:
- DAP protocol compliance across all supported languages
- Cross-platform compatibility and error recovery
- Integration with external toolchains (Node.js debugger, CodeLLDB, Cargo)
- Adapter lifecycle management and dependency injection

This shared module serves as the **architectural foundation** that enables the MCP debugger to support multiple programming languages through a consistent, extensible, and well-tested interface while preserving language-specific debugging capabilities.