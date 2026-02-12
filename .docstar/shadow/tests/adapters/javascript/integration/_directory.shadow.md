# tests\adapters\javascript\integration/
@generated: 2026-02-12T21:00:54Z

## Purpose and Responsibility

Integration test suite for the JavaScript adapter within the debugger system, focusing on smoke testing critical adapter functionality including session management, TypeScript configuration handling, and debug server command generation.

## Key Components

### JavaScript Session Smoke Test (`javascript-session-smoke.test.ts`)
Primary integration test validating the JavaScript adapter's core functionality:
- **Session Configuration**: Tests adapter setup with TypeScript file handling and tsx runtime configuration
- **Launch Config Transformation**: Validates proper transformation of debug launch configurations with runtime executable overrides
- **Adapter Command Building**: Verifies generation of debug server commands with correct paths and port configurations
- **Cross-Platform Support**: Includes platform-specific path handling for Windows/Unix compatibility

## Test Architecture

### Integration Testing Pattern
- **Registry-based Testing**: Uses adapter registry system to test real adapter registration and configuration flows
- **Environment Isolation**: Preserves and restores NODE_OPTIONS and other environment state between tests
- **Mock Management**: Comprehensive mock cleanup to ensure test isolation

### Cross-Platform Compatibility
- Path normalization utilities for consistent assertions across operating systems
- Platform-specific configuration handling for file paths and separators
- Environment variable preservation patterns

## Public API Surface

The integration tests validate key adapter interfaces:
- **Adapter Registration**: Testing `JavascriptAdapterFactory` registration with the adapter registry
- **Configuration Transformation**: Validating `transformLaunchConfig` method behavior
- **Command Generation**: Testing `buildAdapterCommand` output structure and content

## Internal Organization

### Test Flow
1. **Setup Phase**: Environment preservation, adapter registry configuration, mock initialization
2. **Execution Phase**: Adapter registration, configuration transformation, command building
3. **Validation Phase**: Assertion of expected outputs, path validation, port configuration verification
4. **Cleanup Phase**: Environment restoration, registry reset, mock cleanup

### Key Validation Points
- TypeScript runtime configuration (tsx executable)
- Debug server path resolution (`/vendor/js-debug/vsDebugServer.cjs`)
- Port configuration propagation
- Session isolation through unique session IDs

## Dependencies and Integration

- **Adapter Registry System**: Core dependency for adapter management
- **JavaScript Adapter Factory**: Primary component under test
- **Vitest Framework**: Testing infrastructure
- **Cross-platform Path Handling**: Platform detection and normalization utilities

This integration test directory serves as a smoke test gateway ensuring the JavaScript adapter integrates correctly with the broader debugger infrastructure, particularly focusing on TypeScript/JavaScript debugging workflows and debug server command generation.