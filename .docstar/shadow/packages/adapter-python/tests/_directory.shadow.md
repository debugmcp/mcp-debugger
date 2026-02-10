# packages/adapter-python/tests/
@generated: 2026-02-09T18:16:36Z

## Purpose

The `packages/adapter-python/tests` directory contains a comprehensive test suite for the Python debug adapter package, providing validation of Python environment detection, adapter lifecycle management, and debugging infrastructure. The test suite ensures robust functionality across diverse development environments while maintaining comprehensive error handling and user experience standards.

## Test Architecture & Organization

### Testing Levels
The directory implements a multi-level testing strategy:

1. **Package-Level Smoke Tests** (`python-adapter.test.ts`) - Validates public API exports without complex instantiation
2. **Unit Tests** (`unit/` directory) - Comprehensive testing of individual components with extensive mocking

### Core Components Under Test

**PythonAdapterFactory**
- Factory pattern implementation for creating Python debug adapters
- Environment validation with various Python/debugpy configurations
- Metadata retrieval and adapter capabilities

**PythonDebugAdapter** 
- Main adapter class handling debug sessions and state management
- Initialization, state transitions, and disposal workflows
- Event emission patterns and error handling

**Python Utilities**
- Environment discovery and validation utilities
- Cross-platform Python executable discovery
- Version detection and debugpy availability checking

## Testing Infrastructure & Patterns

### Mock Strategy
The test suite employs sophisticated mocking infrastructure:

- **Process Simulation**: EventEmitter-based mock processes with configurable exit codes and output
- **Platform Mocking**: Cross-platform testing via `process.platform` manipulation
- **Dependency Injection**: Factory functions creating consistent mock `AdapterDependencies`
- **Filesystem Mocking**: Comprehensive mocking of Node.js filesystem operations

### Key Testing Frameworks
- **Vitest**: Primary testing framework with extensive mocking capabilities
- **Node.js Built-ins**: Integration testing of `child_process`, `fs`, `path`, `events`
- **External Dependencies**: Mocked `which` command utility and other system tools

## Coverage Areas & Test Categories

### Environment Validation Testing
- Python version requirements and compatibility checking
- Debugpy availability and installation validation
- Virtual environment detection and handling
- Platform-specific behaviors (especially Windows Store alias filtering)

### Adapter Lifecycle Testing
- Initialization and configuration workflows
- State management and transition validation
- Event emission patterns during adapter operations
- Disposal and cleanup procedures

### Python Discovery Testing
- Platform-specific discovery algorithms
- Environment variable precedence and fallback logic
- PATH handling and executable resolution
- CI environment behavior and verbose logging

### Error Handling & Recovery
- Graceful handling of missing dependencies
- Spawn failures and invalid configuration recovery
- User-friendly error message generation
- Debug logging and CI-specific error reporting

## Public API Testing Surface

The test suite validates the complete public interface that consuming code relies on:

**Factory Methods**
- `PythonAdapterFactory.createAdapter()` - Primary adapter creation entry point
- `PythonAdapterFactory.getMetadata()` - Adapter capabilities and metadata
- `PythonAdapterFactory.validateEnvironment()` - Environment compatibility validation

**Utility Functions**
- `findPythonExecutable()` - Cross-platform Python discovery
- `getPythonVersion()` - Version detection and validation

## Data Flow & Component Integration

The test suite validates the complete workflow from environment discovery through adapter lifecycle:

1. **Discovery Phase**: Python executable discovery and validation
2. **Validation Phase**: Environment compatibility and dependency checking
3. **Creation Phase**: Adapter instantiation via factory pattern
4. **Lifecycle Phase**: Initialization, operation, and disposal
5. **Error Handling**: Comprehensive error propagation and user messaging

## Key Dependencies & External Interfaces

**Internal Dependencies**
- `@debugmcp/shared`: Provides adapter interfaces, state enums, and error codes
- Package source code via relative imports (`../src/index.js`)

**External Dependencies**
- Node.js runtime APIs for process management and filesystem operations
- System utilities for Python detection and version checking
- Platform-specific executable discovery mechanisms

The test directory ensures the Python debug adapter package maintains reliability, cross-platform compatibility, and excellent developer experience through comprehensive validation of all public interfaces and critical internal behaviors.