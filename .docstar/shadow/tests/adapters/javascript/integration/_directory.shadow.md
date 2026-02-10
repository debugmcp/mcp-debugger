# tests/adapters/javascript/integration/
@generated: 2026-02-10T21:26:15Z

## Purpose and Responsibility

Integration test suite for the JavaScript adapter functionality, providing smoke tests to validate end-to-end operation of JavaScript/TypeScript debugging capabilities within the adapter system.

## Key Components

### JavaScript Session Smoke Test (`javascript-session-smoke.test.ts`)
Primary integration test validating:
- JavaScript adapter factory registration and configuration
- TypeScript configuration handling with tsx runtime
- Launch configuration transformation for debugging sessions
- Adapter command building and path resolution
- Cross-platform compatibility (Windows/Unix path handling)

## Public API Surface

This directory serves as a validation layer for:
- **JavascriptAdapterFactory** integration with adapter registry
- **Session management** for JavaScript/TypeScript debugging
- **Launch configuration** transformation and validation
- **Adapter command generation** for js-debug integration

## Internal Organization and Data Flow

### Test Infrastructure
- **Environment Management**: Preserves and restores NODE_OPTIONS during test execution
- **Registry Management**: Configures adapter registry with validation controls
- **Cross-Platform Support**: Normalizes paths and handles platform-specific separators

### Test Flow Pattern
1. **Setup Phase**: Register JavaScript adapter factory with session parameters
2. **Configuration Testing**: Validate launch config transformation with tsx runtime
3. **Command Building**: Test adapter command generation and path resolution
4. **Assertion Phase**: Verify correct integration with js-debug VSCode extension

## Important Patterns and Conventions

### Integration Testing Approach
- **Smoke Testing**: Focuses on critical integration points rather than exhaustive coverage
- **Real Adapter Usage**: Tests actual adapter factory and command building (not mocked)
- **Platform Awareness**: Handles Windows vs Unix path differences consistently

### Test Isolation
- Session-specific identifiers (`session-js-3`) prevent test interference
- Environment variable preservation maintains test isolation
- Registry reset between tests ensures clean state

### Dependencies Integration
- **js-debug VSCode Extension**: Primary debugging backend via `/vendor/js-debug/vsDebugServer.cjs`
- **tsx Runtime**: TypeScript execution runtime for Node.js debugging
- **Adapter Registry System**: Core infrastructure for adapter management

This directory validates that the JavaScript adapter can successfully integrate with the broader debugging infrastructure and handle real-world TypeScript debugging scenarios.