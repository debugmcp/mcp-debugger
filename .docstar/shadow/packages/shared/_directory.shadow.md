# packages/shared/
@generated: 2026-02-09T18:17:06Z

## Purpose and Responsibility

The `packages/shared` directory serves as the foundational library for the MCP Debugger ecosystem, providing a comprehensive TypeScript framework that enables multi-language debug adapter development and integration. It establishes standardized contracts, type definitions, and architectural patterns that allow language-specific debug adapters to integrate seamlessly with the main debugger through the Debug Adapter Protocol (DAP).

## Overall Architecture and Component Integration

### Core Library Structure (`src/`)
The library implements a three-tier architecture enabling unified multi-language debugging:

1. **Universal Contracts**: Common interfaces and data structures shared across all languages through the central type system
2. **Policy-Based Customization**: Language-specific behavior encapsulated in dedicated policy classes for each supported language (Go, Java, JavaScript, Python, Rust)
3. **Factory-Based Creation**: Standardized adapter instantiation with validation and dependency injection

### Key Integration Flow
Components work together through a structured lifecycle:
1. **Registration**: Language-specific factories register with central registry using metadata and validation
2. **Instantiation**: Registry creates adapters on-demand through factory pattern with dependency injection
3. **Session Management**: Debug sessions progress through standardized lifecycle states with dual tracking (lifecycle vs execution)
4. **Runtime Operations**: Language policies customize adapter behavior while maintaining DAP protocol compliance
5. **Process Integration**: Abstract process management handles target launching and attachment across platforms

### Testing Infrastructure (`tests/`)
Comprehensive validation system ensuring reliability:
- Language-specific unit tests for debug adapter policy implementations
- Mock infrastructure for external dependencies (filesystem, processes, DAP clients)
- Cross-platform testing capabilities with environment simulation
- Validation of DAP command queuing, session management, and multi-language compatibility

### Build Configuration (`vitest.config.ts`)
Development environment setup providing:
- Node.js test environment with TypeScript support
- Comprehensive coverage reporting (text, JSON, HTML)
- Module resolution with source aliasing (`@/src`)
- Standard monorepo package testing configuration

## Public API Surface

### Primary Entry Points
- **`IDebugAdapter`**: Core contract for debug adapter implementations with lifecycle management and DAP operations
- **`IAdapterRegistry`**: Centralized adapter management and factory system
- **`AdapterPolicy`**: Language-specific behavior customization interface
- **`AdapterFactory`**: Abstract base class for creating language-specific factories
- **`DebugSession`**: Complete session state container with dual state tracking

### Configuration and Runtime Types
- **Session Configuration**: `CustomLaunchRequestArguments`, `GenericAttachConfig`, `SessionConfig`
- **Adapter Metadata**: `AdapterConfig`, `AdapterCapabilities`, `AdapterMetadata`
- **Debug Context**: `Breakpoint`, `Variable`, `StackFrame`, `DebugLocation`
- **State Management**: `SessionLifecycleState`, `ExecutionState`, `DebugLanguage`

### Dependency Abstraction Layer
Complete dependency injection framework for:
- Filesystem operations and executable validation
- Process management and spawning
- Network communication and logging
- DAP protocol handling and session management

## Internal Organization and Data Flow

### Multi-Language Support Pattern
The system employs consistent patterns across language implementations:
- **Factory Pattern**: Uniform adapter creation with validation and version compatibility
- **Strategy Pattern**: Language policies encapsulate behavioral differences
- **Template Method**: Abstract base classes provide common infrastructure
- **Event-Driven Architecture**: State changes and debugging events propagated through EventEmitter pattern

### State Management System
Sophisticated session lifecycle management:
- Separate tracking of lifecycle state (CREATED → ACTIVE → TERMINATED) and execution state (running, paused, stepping)
- Configuration resolution from generic to language-specific parameters
- Process integration supporting various debugging scenarios (launch, attach, proxy)
- Graceful error handling and recovery mechanisms

## Important Patterns and Conventions

### Standards Compliance
- **DAP Protocol**: Full compatibility with VSCode Debug Adapter Protocol
- **Semantic Versioning**: Version compatibility validation across adapter ecosystem
- **Platform Awareness**: Cross-platform executable resolution and path handling
- **Performance Constraints**: < 5ms operation limits with async-first design

### Development and Testing Standards
- **Type Safety**: Enum-based identifiers and compile-time validation
- **Mock-Driven Testing**: Comprehensive external dependency simulation
- **Cross-Platform Validation**: Environment-agnostic testing with platform simulation
- **Tree-Shaking Optimization**: Separate exports for types and runtime values

This shared library serves as the architectural foundation enabling the MCP Debugger to support multiple programming languages through a unified, extensible framework while maintaining type safety, performance, and DAP standards compliance across the entire debugging ecosystem.