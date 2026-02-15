# packages\shared/
@children-hash: cd6d1791b0b7de2c
@generated: 2026-02-15T09:02:11Z

## Overall Purpose and Responsibility

The `packages/shared` directory serves as the foundational contract layer and shared infrastructure for a comprehensive multi-language debug adapter system built on the Debug Adapter Protocol (DAP). It provides the shared abstractions, interfaces, type definitions, and testing infrastructure that enables consistent debugging experiences across multiple programming languages (JavaScript, Python, Go, Rust) while maintaining extensibility, type safety, and reliability.

## Key Components and Integration

### Core Architecture Layers
The directory implements a **policy-based adapter system** with four main architectural components:

1. **Source Code (`src/`)**: The primary implementation layer containing:
   - **Models Layer**: Core data structures (`DebugSession`, `Breakpoint`, dual-state management)
   - **Interfaces Layer**: Contracts for adapter behavior (`IDebugAdapter`), customization policies (`AdapterPolicy`), and dependency injection
   - **Factory Layer**: Standardized adapter creation patterns with version compatibility
   - **Central Entry Point**: Unified facade consolidating all exports

2. **Testing Infrastructure (`tests/`)**: Comprehensive validation layer ensuring:
   - Multi-language adapter policy validation (JavaScript, Rust)
   - DAP protocol compliance and session lifecycle testing
   - Cross-platform compatibility verification
   - Mock-based isolation for reliable unit testing

3. **Test Configuration (`vitest.config.ts`)**: Standardized test environment setup with:
   - Coverage reporting and analysis
   - Module resolution with path aliases
   - Node.js environment configuration for server-side testing

### Component Integration Flow
- **Registry → Factory → Adapter → Policy** data flow enables pluggable debug adapter architectures
- **Source + Tests** work in tandem to ensure reliability across language boundaries
- **Configuration** provides consistent testing environment for quality assurance
- **Dependency Injection** abstracts external dependencies for testability and flexibility

## Public API Surface

### Primary Entry Points
- **`IDebugAdapter`**: Main interface for implementing language-specific debug adapters with complete lifecycle management
- **Policy Framework**: Behavior customization contracts (`JsDebugAdapterPolicy`, `PythonAdapterPolicy`, `GoAdapterPolicy`, `RustAdapterPolicy`)
- **Registry + Factory System**: Centralized adapter management (`IAdapterRegistry`, `IAdapterFactory`) with factory-based instantiation
- **Core Models**: `DebugSession`, launch/attach configurations, and state management enums

### Configuration and State Management
- **Launch/Attach Configurations**: Generic configuration interfaces for various debugging scenarios
- **State Management**: Dual-state tracking with `SessionLifecycleState` and `ExecutionState`
- **Validation Framework**: Comprehensive validation with `ValidationResult` and `AdapterCapabilities`
- **Language Support**: `DebugLanguage` enumeration with extensible language definitions

### Utility Services and Dependencies
- **Process Management**: Debug-specific interfaces for target launching and proxy processes
- **File System Abstraction**: Complete Node.js dependency abstraction layer
- **Synchronization Primitives**: Launch barriers and coordination mechanisms for complex debugging scenarios

## Internal Organization and Data Flow

### Standard Debug Adapter Lifecycle
1. **Discovery**: Registry-based adapter metadata and compatibility validation
2. **Creation**: Factory instantiation with comprehensive dependency injection
3. **Initialization**: Async configuration transformation and validation workflows
4. **Connection**: DAP protocol establishment with capability negotiation
5. **Debugging**: Policy-driven behavior customization for language-specific operations
6. **Cleanup**: Structured teardown with proper resource management

### Quality Assurance Integration
The testing infrastructure validates the entire lifecycle through:
- **Unit Testing**: Comprehensive coverage of adapter policies and session management
- **Protocol Compliance**: DAP command processing and response handling validation
- **Cross-Platform Testing**: Platform-specific behavior verification
- **Mock-Based Isolation**: Controllable test environments with dependency simulation

## Important Patterns and Conventions

### Architectural Patterns
- **Facade Pattern**: Unified access through `index.ts` consolidating all shared functionality
- **Policy Pattern**: Language-specific behavior through pluggable policy interfaces
- **Factory + Registry**: Centralized lifecycle management with lazy instantiation
- **Dependency Injection**: Complete abstraction for external dependencies and testing isolation
- **Template Method**: Extensible base implementations with validation hooks

### Quality and Reliability Standards
- **Type Safety First**: Comprehensive TypeScript interfaces with DAP protocol integration
- **Async-First Design**: Promise-based I/O operations with performance considerations
- **Language Agnostic Core**: Generic interfaces with language-specific extension points
- **Backward Compatibility**: Legacy state mapping functions maintaining API stability
- **Extensible Foundation**: New language adapters can be added without core modifications

### Testing Excellence
- **Protocol Adherence**: Heavy use of `@vscode/debugprotocol` types for DAP compliance
- **Comprehensive Coverage**: Multi-language testing with shared validation patterns
- **Mock Strategy**: Extensive simulation capabilities for reliable unit testing
- **Cross-Platform Validation**: Consistent behavior across development environments

This shared package serves as the essential foundation that enables the broader MCP Debugger ecosystem to maintain consistency, type safety, extensibility, and reliability across multiple programming language implementations while providing robust infrastructure for complex debugging scenarios.