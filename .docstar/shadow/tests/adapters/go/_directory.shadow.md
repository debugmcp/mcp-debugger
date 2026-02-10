# tests/adapters/go/
@generated: 2026-02-10T21:26:44Z

## Overall Purpose and Responsibility

This directory contains the complete test suite for the Go debugger adapter within the debugmcp ecosystem. It provides comprehensive validation of Go/Delve debugger integration through both unit and integration testing approaches, ensuring the adapter properly implements the Debug Adapter Protocol (DAP) and maintains reliable debugging capabilities for Go applications.

## Key Components and Their Relationships

The test suite is structured into two complementary testing layers that work together to validate different aspects of the Go adapter:

### Integration Test Layer (`integration/`)
- **Smoke Testing**: Validates end-to-end adapter functionality without launching actual debugger processes
- **Mock Environment**: Uses comprehensive fake implementations to test adapter behavior in isolation
- **Configuration Validation**: Tests command building, launch configuration transformation, and Go test mode support
- **Factory Integration**: Ensures proper adapter registration and metadata exposure within the debugmcp system

### Unit Test Layer (`unit/`)
- **Component Testing**: Detailed validation of individual adapter components and utilities
- **Lifecycle Management**: Tests adapter state transitions and event handling throughout debug sessions
- **Environment Validation**: Comprehensive testing of Go toolchain and Delve debugger discovery and version validation
- **Platform Coverage**: Cross-platform testing with proper mocking strategies for different operating systems

### Test Infrastructure Synergy
Both layers share common patterns:
- **Comprehensive Mocking**: Child process simulation, file system abstraction, and environment variable management
- **State Validation**: Systematic testing of adapter state transitions and configuration transformations
- **Error Handling**: Thorough validation of failure modes with proper error message translation
- **Dependency Management**: Testing of both Go toolchain and Delve debugger requirements

## Public API Surface and Entry Points

The test suite validates these critical interfaces:

### Primary Factory Interface
- **GoAdapterFactory.createAdapter()**: Main adapter instantiation and dependency injection
- **GoAdapterFactory.getMetadata()**: Adapter capabilities and version information
- **GoAdapterFactory.validate()**: Environment prerequisite validation and toolchain verification

### Core Adapter Interface
- **GoDebugAdapter lifecycle**: init(), dispose(), connect(), disconnect() with proper state management
- **Configuration Processing**: Launch configuration transformation for normal Go programs and test execution
- **DAP Capabilities**: Breakpoint support, log points, and Go-specific exception handling

### Utility Functions
- **Tool Discovery**: findGoExecutable(), findDelveExecutable() with multi-path search strategies
- **Version Management**: Go and Delve version parsing, validation, and DAP support detection
- **Platform Abstraction**: Cross-platform executable resolution and environment handling

## Internal Organization and Data Flow

### Test Execution Flow
```
Environment Setup → Component Testing → Integration Validation → Cleanup
       ↓                   ↓                    ↓               ↓
   Mock config      Unit validation    End-to-end smoke    State restore
```

### Validation Strategy
1. **Unit Phase**: Individual component testing with isolated mocks for precise control
2. **Integration Phase**: End-to-end testing with realistic mock environments for system validation
3. **Cross-Validation**: Both layers test overlapping functionality to ensure consistency

### Mock Architecture
- **Process Simulation**: EventEmitter-based child process mocking with realistic async behavior
- **File System Abstraction**: Controlled executable discovery testing without actual file system dependencies
- **Environment Isolation**: Comprehensive backup/restore patterns to prevent test pollution

## Important Patterns and Conventions

### Testing Patterns
- **Layered Validation**: Unit tests for precise component behavior, integration tests for system-level functionality
- **State Transition Testing**: Systematic validation of adapter lifecycle with proper event emission
- **Configuration Testing**: Both normal Go program debugging and Go test execution scenarios
- **Platform-Aware Testing**: Current platform focus with cross-platform compatibility considerations

### Quality Assurance
- **Comprehensive Coverage**: Tests validate both success paths and error conditions
- **Realistic Simulation**: Mock implementations closely mirror actual debugger behavior
- **Isolation Guarantees**: Each test runs independently without side effects or state leakage
- **Human-Readable Errors**: Proper error message translation for debugging workflow issues

## Integration Context

This test directory ensures the Go adapter reliably integrates with the broader debugmcp system by validating:
- Proper DAP implementation for Go-specific debugging scenarios
- Correct factory registration and metadata exposure
- Robust environment validation and dependency management
- Seamless configuration transformation from generic to Go-specific parameters
- Reliable adapter lifecycle management throughout debug sessions

The test suite provides confidence that the Go adapter delivers consistent debugging capabilities while maintaining compatibility with the Debug Adapter Protocol specification and the debugmcp ecosystem's architecture.