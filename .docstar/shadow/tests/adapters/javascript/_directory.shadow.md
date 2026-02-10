# tests/adapters/javascript/
@generated: 2026-02-10T21:26:27Z

## Purpose and Responsibility

Integration testing suite for the JavaScript adapter module, providing comprehensive validation of JavaScript/TypeScript debugging capabilities within the broader adapter system. This directory serves as the quality assurance layer ensuring the JavaScript adapter integrates correctly with the debugging infrastructure and can handle real-world debugging scenarios.

## Key Components and Integration

### Core Integration Layer
- **JavaScript Adapter Factory Testing**: Validates registration, configuration, and integration with the adapter registry system
- **Session Management Validation**: Tests end-to-end session lifecycle for JavaScript/TypeScript debugging
- **Launch Configuration Pipeline**: Verifies transformation of debug configurations with tsx runtime support
- **Command Generation Testing**: Ensures proper adapter command building and path resolution across platforms

### Test Infrastructure Components
- **Environment Management**: Preserves NODE_OPTIONS and other environment state during test execution
- **Registry Integration**: Configures and manages adapter registry with proper validation controls
- **Cross-Platform Compatibility**: Handles Windows vs Unix path differences and platform-specific behaviors

## Public API Surface

This directory validates the integration points of:
- **JavascriptAdapterFactory**: Primary entry point for JavaScript debugging adapter creation
- **Session Configuration**: Launch config transformation and validation for TypeScript debugging
- **Adapter Command Interface**: Command building and execution path resolution
- **Registry Integration**: Adapter registration and lifecycle management within the broader system

## Internal Organization and Data Flow

### Integration Test Flow
1. **Setup Phase**: Register JavaScript adapter factory with session-specific parameters
2. **Configuration Validation**: Test launch config transformation with tsx runtime integration
3. **Command Generation**: Validate adapter command building with js-debug VSCode extension
4. **Cross-Platform Testing**: Verify path handling and platform-specific adaptations
5. **Integration Verification**: Ensure proper communication with debugging backend

### Test Isolation Strategy
- Session-specific identifiers prevent test interference and enable parallel execution
- Environment variable preservation maintains clean test boundaries
- Registry state management ensures consistent test conditions

## Important Patterns and Conventions

### Integration Testing Philosophy
- **Smoke Testing Approach**: Focuses on critical integration points and real-world usage scenarios
- **Real Component Testing**: Uses actual adapter factories and command builders rather than mocks
- **End-to-End Validation**: Tests complete debugging session lifecycle from configuration to execution

### Dependency Integration
- **js-debug VSCode Extension**: Primary JavaScript debugging backend via vendored debug server
- **tsx Runtime**: TypeScript execution environment for Node.js debugging scenarios  
- **Adapter Registry System**: Core infrastructure providing adapter management and session coordination

### Cross-Platform Considerations
- Normalized path handling for Windows and Unix environments
- Platform-aware command generation and execution
- Consistent behavior across different operating system environments

This directory ensures the JavaScript adapter can successfully integrate with the debugging infrastructure, handle TypeScript debugging scenarios, and maintain compatibility across different platforms and environments.