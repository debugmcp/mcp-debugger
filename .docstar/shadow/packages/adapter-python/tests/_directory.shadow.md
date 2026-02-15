# packages\adapter-python\tests/
@children-hash: 3ea825ea6a4aec70
@generated: 2026-02-15T09:01:40Z

## Overall Purpose & Responsibility

This directory contains the comprehensive test suite for the `@debugmcp/adapter-python` package, providing multi-layered validation of Python debug adapter functionality. The tests ensure reliable Python environment discovery, adapter lifecycle management, and cross-platform compatibility for the Python debugging infrastructure.

## Test Architecture & Organization

### **Smoke Tests (Root Level)**
- **`python-adapter.test.ts`**: Entry-level validation that verifies package exports and basic instantiation without complex dependencies
- Provides quick feedback on packaging issues and export correctness
- Uses minimal Vitest framework integration for lightweight validation

### **Unit Test Suite (`unit/` subdirectory)**
Comprehensive test coverage organized into focused modules:

- **Factory Pattern Tests** (`python-adapter-factory.test.ts`): Validates adapter creation, metadata generation, and environment validation
- **Core Adapter Tests** (`python-debug-adapter.spec.ts`): Tests adapter lifecycle, initialization states, and event management
- **Python Discovery Tests** (`python-utils.comprehensive.test.ts`, `python-utils.discovery.test.ts`): Cross-platform Python executable discovery with edge cases and error scenarios

## Key Testing Components & Integration

### **Shared Testing Infrastructure**
- **Mock Setup Patterns**: Consistent mocking of `child_process.spawn`, file system operations, and Node.js built-ins
- **Environment Simulation**: Sophisticated helpers for simulating different Python installations, versions, and platform behaviors
- **Process Mocking**: Configurable subprocess execution simulation with controllable outputs and exit codes

### **Cross-Platform Validation**
- Windows, Linux, macOS-specific behavior testing
- Platform-specific executable discovery (including Windows Store Python alias filtering)
- Environment variable precedence testing (`PYTHON_EXECUTABLE`, `pythonLocation`, `PYTHON_PATH`)
- Path resolution and Python version validation (>= 3.7 requirement)

### **Adapter Lifecycle Coverage**
- Factory pattern implementation validation
- State transition testing (UNINITIALIZED → READY/ERROR)
- Event emission and listener management verification
- Resource cleanup and disposal testing
- Error propagation and user-friendly error message validation

## Public Testing API Surface

### **Primary Test Entry Points**
- **Smoke tests**: Basic export validation for CI/CD pipelines
- **Unit test suites**: Comprehensive functionality validation for development
- **Mock utilities**: Reusable testing infrastructure for extension and maintenance

### **Key Validation Areas**
- **Environment Discovery**: Python executable detection, virtual environment handling, debugpy module availability
- **Adapter Management**: Initialization, state management, event handling, and cleanup
- **Error Handling**: Graceful degradation, missing dependencies, version incompatibilities

## Testing Framework Dependencies

- **Vitest**: Primary testing framework with comprehensive mocking capabilities
- **@debugmcp/shared**: Shared types and adapter state enums
- **Node.js Built-ins**: Extensive mocking of core modules (`child_process`, `fs`, `path`, `events`)

## Internal Data Flow & Patterns

Tests follow a consistent pattern of:
1. **Environment Setup**: Mock configuration and dependency injection
2. **Execution**: Adapter creation, initialization, and operation testing
3. **Validation**: State verification, event checking, and error handling validation
4. **Cleanup**: Mock restoration and environment cleanup

The test suite provides confidence in the Python adapter's ability to reliably discover Python environments, validate development setups, and manage debug sessions across diverse development environments and platforms, serving as the quality gate for the Python debugging infrastructure.