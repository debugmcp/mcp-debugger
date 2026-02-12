# tests/unit/adapter-python/
@generated: 2026-02-11T23:47:34Z

## Python Debug Adapter Test Suite

This directory contains comprehensive unit tests for the Python debug adapter implementation, specifically testing the `PythonDebugAdapter` class that enables Python debugging capabilities within VS Code through the Debug Adapter Protocol (DAP).

### Overall Purpose

The test suite validates the complete lifecycle and functionality of the Python debug adapter, ensuring reliable debugging experiences for Python developers. It covers environment validation, debugpy integration, configuration management, and DAP communication protocols.

### Key Components & Architecture

**Test Infrastructure:**
- Mock-based testing using Vitest framework with comprehensive dependency isolation
- Standardized mock factories for consistent test setup across all test cases
- EventEmitter simulation for testing asynchronous adapter communication

**Core Test Categories:**
- **Environment Validation**: Tests Python executable resolution, version checking, and debugpy installation detection
- **Configuration Management**: Validates launch configuration transformation and default settings application  
- **DAP Communication**: Tests Debug Adapter Protocol message handling, exception filters, and event processing
- **Lifecycle Management**: Validates adapter initialization, connection state management, and proper cleanup
- **Error Handling**: Tests error message translation and user-friendly diagnostic reporting

### Testing Patterns & Conventions

**Dependency Injection**: Uses factory patterns to create standardized mock dependencies, enabling isolated unit testing without external system dependencies.

**State Machine Testing**: Validates adapter lifecycle transitions (initialization → connection → disposal) with proper event emission and state consistency.

**Mock Strategy**: Extensively mocks external dependencies including:
- File system operations (`python-utils`)
- Process spawning (`child_process`)
- Network communication for debugpy integration

**Error Translation Testing**: Ensures Python/debugpy technical errors are transformed into actionable user guidance with installation instructions and troubleshooting steps.

### Integration Points

The test suite validates integration with:
- **debugpy**: Python's official debug adapter implementation
- **Python Runtime**: Version validation and virtual environment detection
- **VS Code DAP**: Debug Adapter Protocol compliance and capability reporting
- **Configuration System**: Launch configuration transformation and validation

This comprehensive test coverage ensures the Python debug adapter provides reliable debugging functionality while maintaining proper error handling and user experience standards.