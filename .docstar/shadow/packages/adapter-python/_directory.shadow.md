# packages/adapter-python/
@generated: 2026-02-10T21:27:26Z

## Overall Purpose and Responsibility

The `packages/adapter-python` directory implements a complete Python debugging adapter for the mcp-debugger framework. This module serves as a bridge between the Debug Adapter Protocol (DAP) and Python's debugpy debugging infrastructure, providing reliable cross-platform Python debugging capabilities with comprehensive environment detection and validation.

## Key Components and Integration

The package follows a three-layer architecture with clear separation of concerns:

### Core Architecture Layers

1. **Factory Layer** (`PythonAdapterFactory`): Provides dependency injection patterns for adapter creation with comprehensive environment validation
2. **Adapter Layer** (`PythonDebugAdapter`): Implements DAP protocol operations, manages debugging session lifecycle, and maintains debugpy connection state  
3. **Utilities Layer** (`utils/`): Handles cross-platform Python executable discovery, environment validation, and debugpy integration

### Component Integration Flow

The components integrate through a validation-first approach:
- **Environment Discovery**: Utilities perform sophisticated cross-platform Python executable detection with platform-specific strategies (Windows Store Python handling, Unix PATH resolution)
- **Validation Pipeline**: Factory validates Python ≥3.7 and debugpy availability before adapter instantiation
- **Session Management**: Adapter manages complete debugging lifecycle from initialization through DAP request/response processing
- **State Tracking**: Event-driven state transitions with proper connection cleanup and error handling

## Public API Surface

### Primary Entry Points (`src/index.ts`)

**Factory Interface:**
- `PythonAdapterFactory`: Main factory class implementing `IAdapterFactory` for adapter creation and environment validation
- `createAdapter()`: Instantiates validated Python debug adapters
- `validate()`: Comprehensive environment validation with detailed error reporting
- `getMetadata()`: Returns adapter capabilities and supported file extensions (.py, .pyw)

**Debug Adapter Interface:**
- `PythonDebugAdapter`: Core adapter implementing `IDebugAdapter` for debugging sessions
- `initialize()`: Environment validation and state transitions
- `connect()/disconnect()`: debugpy connection lifecycle management  
- `sendDapRequest()`: DAP protocol message handling with Python-specific transformations
- `getCapabilities()`: Returns debugging capabilities (breakpoints, exception handling, variable inspection)

**Utility Functions:**
- `findPythonExecutable`: Cross-platform Python executable discovery
- `getPythonVersion`: Python version extraction and validation
- `setDefaultCommandFinder`: Configuration point for custom command resolution
- `CommandNotFoundError`: Structured error handling for missing executables

## Internal Organization and Data Flow

### Environment Detection Pipeline
1. **Discovery Phase**: Platform-specific executable search with Windows Store Python filtering and Unix preference handling
2. **Validation Phase**: Python version checking (≥3.7) and debugpy availability validation
3. **Caching Layer**: TTL-based caching (60 seconds) for expensive operations
4. **Selection Logic**: Prioritization of debugpy-enabled Python installations

### Debug Session Lifecycle
1. **Pre-flight Validation**: Factory performs comprehensive environment checks
2. **Adapter Instantiation**: Creation with validated Python dependencies
3. **Session Initialization**: Environment setup and DAP capability negotiation
4. **Protocol Processing**: Request/response handling with Python-specific transformations
5. **Connection Management**: debugpy integration and cleanup

## Important Patterns and Conventions

### Cross-Platform Robustness
- Sophisticated Windows Store Python alias detection and filtering
- Platform-specific search strategies with environment variable precedence
- Graceful degradation with comprehensive error reporting

### Performance Optimization
- TTL-based caching for expensive subprocess operations
- Lazy evaluation of debugpy availability checking
- Efficient validation pipeline with early termination on failures

### Development Experience
- Comprehensive test coverage with mock-driven testing infrastructure
- CI-aware logging and error reporting
- Monorepo integration with workspace aliases for shared dependencies

### State Management
- Event-driven state transitions using `AdapterState` enum
- Thread-safe caching mechanisms with proper cleanup
- Connection state tracking with graceful error recovery

## Testing and Validation

The package includes a comprehensive test suite covering:
- **Unit Tests**: Component-level validation for utilities, factory, and adapter layers
- **Integration Tests**: Package-level API surface verification
- **Cross-Platform Tests**: Windows, macOS, and Linux compatibility validation
- **Error Scenarios**: Comprehensive edge case and failure mode coverage

This module serves as the definitive Python debugging solution within the mcp-debugger ecosystem, providing enterprise-grade reliability, cross-platform compatibility, and seamless integration with modern Python development workflows.