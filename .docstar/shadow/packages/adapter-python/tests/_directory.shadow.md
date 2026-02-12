# packages/adapter-python/tests/
@generated: 2026-02-11T23:47:58Z

## Overall Purpose and Responsibility

This test directory provides comprehensive validation for the `@debugmcp/adapter-python` package, ensuring robust Python debug adapter functionality across different platforms and environments. The test suite validates the complete lifecycle from Python environment discovery to debug session management, with particular focus on cross-platform compatibility and error handling.

## Key Components and Integration

### Test Organization
- **`python-adapter.test.ts`**: Package-level smoke tests validating basic exports and instantiation
- **`unit/` directory**: Comprehensive unit test suite covering core adapter functionality

### Component Relationships
The tests validate a three-tier architecture:

1. **Factory Layer** (`PythonAdapterFactory` tests): Validates the factory pattern for creating configured adapter instances
2. **Adapter Layer** (`PythonDebugAdapter` tests): Tests core adapter lifecycle, state management, and event handling  
3. **Discovery Layer** (`python-utils` tests): Validates Python environment detection and validation across platforms

### Testing Flow
```
Package Exports → Factory Creation → Environment Discovery → Adapter Initialization → State Management
```

## Public API Surface Testing

The test suite validates these main entry points:
- **`PythonAdapterFactory`**: Factory class for creating configured Python debug adapters
- **`PythonDebugAdapter`**: Main adapter class with lifecycle management
- **`findPythonExecutable`**: Utility function for cross-platform Python discovery

## Internal Organization and Data Flow

### Test Infrastructure
- **Mock Framework**: Vitest-based testing with comprehensive Node.js API mocking
- **Platform Simulation**: Cross-platform behavior testing (Windows/Unix path resolution, environment variables)
- **Process Mocking**: Child process execution simulation for Python environment validation

### Key Test Utilities
- `createDependencies()`: Factory for mock adapter dependencies
- `createSpawn()`: Helper for simulating Python subprocess execution
- `setSuccessfulEnvironment()`: Test setup for successful environment scenarios

### Data Flow Validation
Tests verify the complete data flow:
1. **Discovery**: Python executable detection via PATH/environment variables
2. **Validation**: Python version (≥3.7) and debugpy package verification
3. **Initialization**: Adapter state transitions (UNINITIALIZED → READY/ERROR)
4. **Error Handling**: User-friendly error translation and logging

## Important Patterns and Conventions

### Testing Patterns
- **Event-driven testing**: Validates adapter lifecycle events and state transitions
- **Platform-specific scenarios**: Tests Windows Store Python, virtual environments, and PATH resolution
- **Error boundary testing**: Comprehensive error code validation and user-friendly messaging
- **Mock isolation**: Each test uses fresh mocks to prevent cross-test contamination

### Coverage Areas
- **Cross-platform compatibility**: Windows Store aliases, Unix PATH resolution, environment variable precedence
- **Environment validation**: Python version compatibility, debugpy availability detection
- **State management**: Adapter lifecycle with proper cleanup and disposal
- **Error reporting**: CI-specific logging and user-friendly error translation

### Critical Validation Points
- Python environment discovery across different installation types (system, virtual, conda)
- Graceful degradation when dependencies are missing
- Thread-safe adapter initialization and cleanup
- Platform-specific executable resolution strategies

The test suite ensures the Python debug adapter can reliably function across diverse development environments while providing clear feedback for configuration issues.