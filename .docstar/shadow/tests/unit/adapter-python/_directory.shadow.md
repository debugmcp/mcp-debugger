# tests\unit\adapter-python/
@generated: 2026-02-12T21:00:55Z

## Python Debug Adapter Test Module

This directory contains comprehensive unit tests for the Python language debug adapter implementation, specifically testing the `PythonDebugAdapter` class and its integration with the debugpy debugging protocol.

### Overall Purpose

The test suite validates the complete lifecycle and functionality of Python debugging capabilities within a multi-language debug environment. It ensures the adapter can properly:
- Validate Python runtime environments and dependencies
- Transform and manage debug configurations
- Communicate with the Debug Adapter Protocol (DAP)
- Handle Python-specific debugging features and error scenarios

### Key Components

#### Core Test Infrastructure
- **Mock Management**: Comprehensive mocking of external dependencies (`child_process`, `python-utils`) for isolated testing
- **Dependency Factory**: Standardized creation of mock dependencies with consistent logger interfaces
- **Test Lifecycle**: Automatic cleanup and state management between test cases

#### Primary Test Categories

**Environment Validation Engine**
- Python executable resolution and caching mechanisms
- Version compatibility checking (Python 3.7+ requirement)
- Debugpy installation detection and virtual environment handling
- Graceful error handling for runtime environment issues

**DAP Communication Layer**
- Command building for debugpy adapter invocation
- Exception filter validation and breakpoint management
- Event handling and thread tracking from debug sessions
- Feature support detection and requirement specification

**Configuration Management**
- Launch configuration transformation with Python-specific defaults
- Default configuration generation for baseline debugging setups
- DAP capabilities reporting including exception breakpoint filters

**Error Handling & User Experience**
- Translation of technical Python/debugpy errors into user-friendly messages
- Installation guidance and troubleshooting support
- State management during error conditions

**Debugpy Integration**
- Spawn-based version detection of debugpy installations
- Process lifecycle management for debug sessions
- Connection state tracking and event emission

### Public API Surface

The tests validate the main entry points of the Python debug adapter:
- `PythonDebugAdapter` constructor and initialization
- `resolveExecutablePath()` for environment validation
- `buildAdapterCommand()` for launching debug sessions  
- `transformLaunchConfig()` for configuration processing
- `supportsFeature()` and `getFeatureRequirements()` for capability detection
- `translateErrorMessage()` for user-facing error handling
- Lifecycle methods: `connect()`, `disconnect()`, `dispose()`

### Architecture Patterns

The test suite employs several key patterns:
- **Dependency Injection**: Extensive use of mock dependencies for isolated unit testing
- **State Machine Testing**: Validation of adapter lifecycle transitions and state management
- **Event-Driven Testing**: EventEmitter patterns for testing asynchronous debug session communication
- **Caching Validation**: Tests for performance optimization through result caching
- **Error Boundary Testing**: Comprehensive validation of error handling and recovery scenarios

### Internal Organization

Tests are organized by functional responsibility rather than implementation structure:
1. **Environment Setup & Validation**: Runtime environment compatibility
2. **Command Generation**: DAP protocol command construction
3. **Feature Detection**: Capability reporting and requirement specification
4. **Error Translation**: User experience and error messaging
5. **Lifecycle Management**: Connection, disconnection, and cleanup flows
6. **Integration Testing**: End-to-end debugpy integration scenarios

This organization ensures comprehensive coverage of all Python debugging scenarios while maintaining clear separation of concerns for maintainability and debugging of test failures.