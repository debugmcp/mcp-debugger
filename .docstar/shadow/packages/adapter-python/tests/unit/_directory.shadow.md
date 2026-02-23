# packages\adapter-python\tests\unit/
@children-hash: 7fe7e42536b07bd0
@generated: 2026-02-23T15:26:33Z

## Purpose
This directory contains the comprehensive unit test suite for the Python adapter module, validating Python debugging environment discovery, factory pattern implementation, and adapter lifecycle management. The tests ensure robust Python executable detection across platforms, proper error handling, and reliable debugpy integration for Python debugging capabilities in the MCP system.

## Key Components & Organization

### Core Test Modules

**PythonAdapterFactory Tests** (`python-adapter-factory.test.ts`)
- Tests factory pattern implementation for creating Python debug adapters
- Validates environment validation logic and metadata accuracy
- Covers critical edge case (Issue #16) where system Python lacks debugpy but project virtualenv has it
- Ensures proper distinction between hard failures (missing Python) and soft failures (missing debugpy)

**PythonDebugAdapter Tests** (`python-debug-adapter.spec.ts`) 
- Tests adapter initialization, state management, and lifecycle
- Validates state transitions (UNINITIALIZED → READY → ERROR states)
- Tests event emission patterns and error handling
- Covers environment validation integration and cleanup procedures

**Python Discovery Utilities Tests** (`python-utils.comprehensive.test.ts`, `python-utils.discovery.test.ts`)
- Comprehensive testing of Python executable discovery across Windows, Linux, and macOS
- Tests cross-platform behavior including Windows Store alias handling
- Validates environment variable precedence (`PYTHON_EXECUTABLE`, `pythonLocation`, `PYTHON_PATH`)
- Tests debugpy module detection and preference logic
- Covers verbose discovery logging for CI/debugging scenarios

## Test Architecture & Patterns

### Common Testing Infrastructure
- **Mock Factories**: Standardized dependency creation (`createDependencies()`, `createSpawn()`)
- **Platform Simulation**: Cross-platform testing using `process.platform` mocking
- **Environment Management**: Systematic environment variable manipulation with proper cleanup
- **Async Process Simulation**: EventEmitter-based child process mocking with configurable outputs

### Key Testing Strategies
- **Factory Pattern Validation**: Ensures proper adapter instantiation and metadata provision
- **Environment Validation Testing**: Distinguishes between blocking errors (Python version) and warnings (debugpy availability)
- **Cross-Platform Discovery**: Tests Windows-specific behavior (Store aliases, .exe extensions) vs Unix PATH resolution
- **Error Scenario Coverage**: Comprehensive failure path testing with user-friendly error messages
- **State Management**: Validates adapter lifecycle transitions and cleanup procedures

## Critical Test Coverage Areas

### Python Environment Discovery
- Multi-platform Python executable detection (PATH, environment variables, Windows Store)
- debugpy module availability checking with graceful fallback
- Version validation (Python 3.7+ requirement)
- Virtual environment vs system Python handling

### Adapter Integration
- Factory pattern implementation for adapter creation
- Environment validation integration with adapter initialization
- State management and event emission during adapter lifecycle
- Error propagation and user-friendly message translation

### Edge Cases & Real-World Scenarios
- **Issue #16**: System Python without debugpy (must allow adapter registration)
- Windows Store Python alias detection and filtering
- CI environment specific behavior and verbose logging
- Multiple Python installation preference logic

## Dependencies & External Integration
- **Vitest Framework**: Comprehensive mocking and testing capabilities
- **Node.js APIs**: child_process, fs, path, events module mocking
- **Platform Abstraction**: Cross-platform behavior testing and validation
- **Source Module Integration**: Tests actual adapter-python implementation components

This test suite ensures the Python adapter can reliably discover and validate Python environments across diverse deployment scenarios while providing meaningful error messages and graceful degradation when dependencies are partially available.