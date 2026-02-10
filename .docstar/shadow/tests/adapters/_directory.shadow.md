# tests/adapters/
@generated: 2026-02-10T01:20:22Z

## Purpose & Overall Responsibility

The `tests/adapters` directory provides comprehensive validation infrastructure for the debugmcp system's language-specific debugging adapters. This module ensures that all supported debugging adapters (Go, JavaScript/TypeScript, Python, Rust) correctly integrate with the Debug Adapter Protocol (DAP) and maintain reliable functionality across different platforms and environments.

## Module Architecture & Component Integration

The testing architecture follows a consistent multi-layered validation approach across all language adapters:

### Language-Specific Test Suites
- **Go (`go/`)**: Validates Delve debugger integration with comprehensive unit and integration testing
- **JavaScript (`javascript/`)**: Tests TypeScript debugging through tsx runtime and js-debug server integration  
- **Python (`python/`)**: Covers Python environment discovery, debugpy integration, and MCP protocol communication
- **Rust (`rust/`)**: Validates CodeLLDB integration through sophisticated mock-based testing

### Common Testing Patterns
Each adapter test suite implements a standardized testing strategy:
- **Unit Testing Layer**: Fast, isolated validation with comprehensive mocking of system dependencies
- **Integration Testing Layer**: End-to-end workflow validation using controlled environments
- **Cross-Platform Support**: Consistent behavior validation across Windows, Linux, and macOS
- **Mock Infrastructure**: Sophisticated dependency injection preventing external process execution during testing

## Public API Surface & Key Entry Points

### Adapter Factory Interface (Common Across Languages)
- **`createAdapter()`**: Adapter instance creation and language assignment
- **`getMetadata()`**: Metadata retrieval including version and supported file extensions
- **`validate()`**: Environment prerequisite validation

### Adapter Lifecycle Interface (Standardized)
- **State Management**: Event-driven lifecycle (IDLE → READY → CONNECTED → DISPOSED)
- **Configuration Transformation**: Launch config processing for language-specific runtimes
- **Command Generation**: Debug server command construction with proper parameters
- **DAP Capabilities**: Breakpoint support, exception handling, and logging configuration

### Environment Discovery & Validation
- **Runtime Detection**: Language toolchain discovery and version validation
- **Platform Adaptation**: Cross-platform executable finding and path resolution
- **Dependency Checking**: Debugger availability verification (Delve, debugpy, CodeLLDB)

## Internal Organization & Data Flow

### Standardized Test Workflow
All adapter tests follow a consistent four-phase validation pattern:

1. **Environment Setup**: Platform detection, dependency mocking, registry initialization
2. **Adapter Registration**: Factory registration and adapter instantiation validation
3. **Configuration Processing**: Launch config transformation and command generation testing
4. **Cleanup & Isolation**: State restoration and mock cleanup for test independence

### Integration Points Validation
- **Adapter Registry System**: Dynamic adapter loading and factory registration
- **Debug Protocol Compliance**: DAP message handling and capability negotiation
- **Runtime Environment**: Language-specific debugger integration and configuration
- **Cross-Platform Compatibility**: Consistent behavior across operating systems

## Critical Validation Areas

### Environment Prerequisites
- Toolchain availability and minimum version requirements
- Debugger installation and capability validation
- Platform-specific configuration and path handling

### Protocol Integration
- Debug Adapter Protocol compliance and message handling
- Session management and state transition validation
- Breakpoint and exception handling capabilities
- Configuration transformation for different debugging scenarios

### Reliability & Safety
- Comprehensive error boundary testing and failure mode validation
- Test isolation preventing actual debugger process execution
- Platform-agnostic testing with controlled dependency injection
- CI/CD optimization for automated validation workflows

This directory ensures that all debugmcp language adapters maintain consistent, reliable debugging capabilities while providing comprehensive validation coverage that prevents regressions and ensures cross-platform compatibility. The standardized testing patterns enable maintainable test suites that can evolve with the debugging infrastructure while maintaining high confidence in adapter reliability.