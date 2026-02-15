# tests\unit\adapter-python/
@children-hash: c24d32457edc32ca
@generated: 2026-02-15T09:01:23Z

## Unit Test Suite for Python Debug Adapter

This directory contains the comprehensive unit test suite for the Python language debug adapter implementation. It provides thorough testing coverage of the `PythonDebugAdapter` class, which serves as the bridge between VS Code's Debug Adapter Protocol (DAP) and Python's debugpy debugging framework.

### Overall Purpose

The test suite validates the complete functionality of Python debugging capabilities within the VS Code extension environment, ensuring reliable debug session management, proper environment validation, and seamless integration with Python's debugging infrastructure.

### Key Components & Architecture

#### Test Infrastructure
- **Mock Framework**: Utilizes Vitest with comprehensive mocking of external dependencies including `child_process`, file system operations, and Python utilities
- **Dependency Injection Pattern**: Employs a standardized dependency factory for creating isolated test environments with consistent mock interfaces
- **Event-Driven Testing**: Simulates EventEmitter patterns to test asynchronous debug adapter communication

#### Core Testing Areas

**Environment & Prerequisites**
- Python executable resolution and caching mechanisms
- Version compatibility validation (Python 3.7+ requirements)
- Debugpy installation detection and virtual environment handling
- Graceful error handling for missing or invalid Python environments

**Debug Adapter Protocol Integration**
- DAP request/response handling and filtering
- Exception breakpoint configuration and validation
- Debug session lifecycle management (initialization, connection, disposal)
- Event handling for thread tracking and state transitions

**Configuration & Capabilities**
- Launch configuration transformation with Python-specific defaults
- Feature detection and requirement reporting
- DAP capabilities exposure including supported breakpoint types
- Default configuration generation

**Error Handling & User Experience**
- Error message translation for common Python/debugpy issues
- User-friendly installation guidance and troubleshooting
- State management during error conditions

### Public API Surface

The test suite validates the primary interface points of the `PythonDebugAdapter`:

- **Environment Validation**: `resolveExecutablePath()`, environment checking methods
- **Configuration Management**: `transformLaunchConfig()`, `getDefaultLaunchConfig()`
- **Feature Support**: `supportsFeature()`, `getFeatureRequirements()`
- **Lifecycle Methods**: Initialization, connection management, disposal
- **DAP Communication**: Request filtering, event handling, capabilities reporting
- **Error Handling**: `translateErrorMessage()`, installation helpers

### Internal Organization

The test suite follows a logical progression from low-level environment validation through high-level debug session management:

1. **Foundation Layer**: Environment detection, Python executable resolution, dependency validation
2. **Configuration Layer**: Launch configuration processing, default value application
3. **Protocol Layer**: DAP request handling, event processing, capabilities negotiation
4. **Session Layer**: Debug session lifecycle, connection management, cleanup procedures

### Testing Patterns & Conventions

- **Isolation**: Each test uses fresh mock instances to prevent cross-test contamination
- **State Validation**: Tests verify both public behavior and internal state transitions
- **Error Simulation**: Comprehensive error scenario testing with various failure modes
- **Async Handling**: Proper testing of Promise-based operations and event-driven communication
- **Type Safety**: Strategic type casting to access private methods for thorough internal testing

This test suite ensures the Python debug adapter provides reliable, user-friendly debugging capabilities while maintaining robust error handling and clear user feedback throughout the debugging workflow.