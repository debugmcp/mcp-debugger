# tests/adapters/
@generated: 2026-02-10T21:27:14Z

## Overall Purpose and Responsibility

This directory contains the comprehensive test suite for all debugger adapters within the debugmcp ecosystem. It provides a multi-layered testing infrastructure that validates adapter implementations for Go, JavaScript/TypeScript, Python, and Rust debugging scenarios. The test suite ensures reliable integration with the Debug Adapter Protocol (DAP), proper environment discovery, cross-platform compatibility, and seamless integration within the broader debugmcp system architecture.

## Key Components and Their Integration

### Language-Specific Adapter Test Suites
The directory is organized by programming language, with each subdirectory providing comprehensive validation for its respective debugger adapter:

- **go/**: Dual-layer testing (unit + integration) for Go/Delve debugger integration with comprehensive mocking infrastructure
- **javascript/**: Integration-focused testing for JavaScript/TypeScript debugging with tsx runtime and js-debug VSCode extension support  
- **python/**: Cross-platform testing spanning unit validation and real-world integration for Python/debugpy environments
- **rust/**: Smoke testing approach for Rust/CodeLLDB integration using sophisticated dependency injection patterns

### Unified Testing Architecture
All adapter test suites share common architectural patterns:

**Multi-Layer Validation Strategy:**
- Unit tests provide isolated component validation with comprehensive mocking
- Integration tests validate end-to-end workflows with realistic or actual implementations
- Smoke tests verify critical integration points without external process dependencies

**Cross-Platform Infrastructure:**
- Systematic testing across Windows, Linux, and macOS environments
- Platform-specific executable discovery and command generation validation
- Environment variable management with proper isolation and cleanup

**Mock and Dependency Management:**
- Sophisticated dependency injection frameworks for controlled testing
- Child process simulation with EventEmitter-based async behavior
- File system abstraction and environment state preservation

## Public API Surface and Entry Points

### Adapter Factory Validation
Each test suite validates the primary factory interfaces:
- **createAdapter()**: Adapter instantiation with proper dependency injection
- **getMetadata()**: Adapter capabilities and version information exposure
- **validate()**: Environment prerequisite validation and toolchain verification

### Core Adapter Interface Testing
- **Lifecycle Management**: init(), dispose(), connect(), disconnect() state transitions
- **Configuration Processing**: Launch configuration transformation for language-specific debugging scenarios
- **DAP Implementation**: Debug Adapter Protocol compliance and language-specific feature support

### Utility Function Coverage
- **Tool Discovery**: Language-specific debugger and runtime discovery across platforms
- **Version Management**: Toolchain version detection, parsing, and compatibility validation
- **Environment Handling**: Cross-platform executable resolution and environment variable management

## Internal Organization and Data Flow

### Testing Strategy Synthesis
```
Environment Setup → Unit Validation → Integration Testing → Cross-Platform Verification → Cleanup
       ↓                   ↓                ↓                    ↓                    ↓
   Mock config      Component tests    End-to-end flows    Platform coverage    State restore
```

### Validation Pipeline
1. **Unit Phase**: Isolated component testing with precise mock control for individual adapter utilities
2. **Integration Phase**: End-to-end workflow validation using realistic environments or sophisticated mocking
3. **Platform Phase**: Cross-platform compatibility verification with environment-specific adaptations
4. **System Phase**: Validation of adapter integration within the broader debugmcp ecosystem

### Quality Assurance Framework
- **Test Isolation**: Comprehensive environment management preventing test pollution and ensuring reproducible results
- **Error Coverage**: Systematic validation of both success paths and failure conditions
- **Realistic Simulation**: Mock implementations that closely mirror actual debugger and runtime behavior
- **CI/CD Integration**: Extensive diagnostic logging and failure artifact collection for continuous integration environments

## Important Patterns and Conventions

### Universal Testing Patterns
- **Dependency Injection**: Controlled testing environments through factory-based mock management
- **State Transition Testing**: Systematic validation of adapter lifecycles with proper event emission
- **Configuration Transformation**: Testing of generic to language-specific parameter conversion
- **Platform Abstraction**: Normalized testing across different operating systems with environment-aware mocking

### Adapter Integration Validation
- **Factory Registration**: Ensuring proper adapter registration within the debugmcp adapter registry
- **DAP Compliance**: Validation of Debug Adapter Protocol implementation for language-specific debugging features
- **Session Management**: Testing of debugging session lifecycle from configuration through termination
- **Error Translation**: Proper error message handling and debugging workflow issue reporting

## System Integration Role

This test directory serves as the quality assurance foundation for the entire debugmcp adapter ecosystem. It ensures that all supported debugger adapters (Go, JavaScript/TypeScript, Python, Rust) can reliably integrate with the system architecture while maintaining:

- **Protocol Compliance**: Consistent Debug Adapter Protocol implementation across all language adapters
- **Cross-Platform Reliability**: Dependable operation across Windows, Linux, and macOS environments
- **Environment Robustness**: Proper handling of diverse development environment configurations
- **System Cohesion**: Seamless integration with the broader debugmcp infrastructure and adapter registry

The comprehensive test coverage provides confidence that the debugmcp system can deliver consistent, reliable debugging capabilities across multiple programming languages and deployment environments.