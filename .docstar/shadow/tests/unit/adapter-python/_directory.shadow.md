# tests\unit\adapter-python/
@generated: 2026-02-12T21:05:43Z

## Python Debug Adapter Unit Testing Module

This directory contains comprehensive unit tests for the Python debug adapter implementation, focusing on validating the core functionality that enables Python debugging within the larger debug system.

### Overall Purpose & Responsibility

The module serves as the primary test suite for `PythonDebugAdapter`, ensuring the adapter can:
- Validate Python runtime environments and dependencies
- Transform debug configurations for Python-specific requirements
- Manage debug session lifecycles and DAP (Debug Adapter Protocol) communication
- Integrate with debugpy (Microsoft's Python debugger) for actual debugging capabilities
- Provide user-friendly error handling and installation guidance

### Key Components & Architecture

#### Core Test Infrastructure
- **Mock Management**: Comprehensive mocking of external dependencies (`child_process`, `python-utils`) for isolated testing
- **Dependency Injection**: Factory pattern (`createDependencies()`) creates standardized mock dependencies with consistent logger interfaces
- **State Machine Testing**: Validates adapter lifecycle transitions (initialization → connection → disposal)

#### Primary Test Categories

**Environment Validation Testing**
- Python executable resolution and caching mechanisms
- Version compatibility checks (Python 3.7+ requirement)
- Debugpy installation detection and virtual environment handling
- Graceful error handling for missing or incompatible environments

**Debug Adapter Protocol (DAP) Integration**
- Command building for debugpy adapter invocation
- Exception breakpoint filter validation
- Event handling and thread tracking
- Capabilities reporting to debug clients

**Configuration & Feature Management**
- Launch configuration transformation with Python-specific defaults
- Feature support detection and requirement specification
- Error message translation for improved user experience

### Public API Surface

The tests validate the main entry points of the Python debug adapter:

- `resolveExecutablePath()` - Environment validation and executable discovery
- `buildAdapterCommand()` - Debug session command construction
- `transformLaunchConfig()` - Configuration preprocessing
- `supportsFeature()` / `getFeatureRequirements()` - Capability querying
- `translateErrorMessage()` - User-friendly error handling
- Lifecycle methods: `initialize()`, `connect()`, `disconnect()`, `dispose()`

### Internal Organization & Data Flow

1. **Environment Phase**: Validates Python installation, version, and debugpy availability
2. **Configuration Phase**: Transforms user configurations into debugpy-compatible format
3. **Session Phase**: Manages debug adapter process lifecycle and DAP communication
4. **Event Phase**: Handles debug events and maintains session state

### Testing Patterns & Conventions

- **Isolation**: Each test uses fresh mocks to prevent cross-contamination
- **Event-Driven Testing**: EventEmitter patterns simulate real debug adapter communication
- **Type Safety**: Strategic type casting to access private methods for internal state validation
- **Error Simulation**: Comprehensive error scenario testing with mock process failures
- **Caching Verification**: Ensures performance optimizations work correctly

This test module ensures the Python debug adapter reliably integrates Python debugging capabilities into the broader multi-language debug system, with robust error handling and user experience considerations.