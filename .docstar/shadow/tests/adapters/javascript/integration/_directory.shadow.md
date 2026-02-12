# tests\adapters\javascript\integration/
@generated: 2026-02-12T21:05:43Z

## Purpose and Responsibility

This integration test directory validates the JavaScript adapter's core functionality through smoke testing, ensuring proper TypeScript configuration handling, session management, and debug command generation with cross-platform compatibility.

## Key Components and Organization

### Test Suite Structure
The directory contains integration smoke tests that focus on critical adapter integration points rather than exhaustive unit testing. Tests are designed with platform-aware path handling and environment isolation patterns.

### Core Testing Areas

#### Session Management Integration
- Validates JavaScript adapter session lifecycle with isolated session IDs (`session-js-3`)
- Tests adapter registry integration with proper factory registration
- Ensures clean test isolation through environment preservation/restoration

#### Configuration Transformation
- Tests TypeScript configuration handling with tsx runtime detection
- Validates launch configuration transformation for debug sessions
- Verifies proper runtime executable and argument configuration

#### Command Generation
- Tests adapter command building for debug server initialization
- Validates absolute path resolution for adapter commands
- Ensures proper port configuration and debug server endpoint setup

## Public Integration Points

### Primary Test Entry Points
- **JavaScript Session Smoke Test**: Main integration validation covering adapter lifecycle, configuration transformation, and command generation
- **Cross-Platform Support**: Platform detection and path normalization utilities for Windows/Unix compatibility

### Validated API Surface
- `JavascriptAdapterFactory` registration and configuration
- `transformLaunchConfig` for TypeScript session setup
- `buildAdapterCommand` for debug server command construction
- Adapter registry integration patterns

## Internal Organization and Data Flow

### Test Lifecycle Management
1. **Setup Phase**: Environment preservation, adapter registry initialization, mock configuration
2. **Execution Phase**: Adapter factory registration, configuration transformation, command building
3. **Teardown Phase**: Environment restoration, registry cleanup, mock restoration

### Cross-Platform Strategy
- Platform detection for path separator handling
- Path normalization utilities for consistent assertions
- Environment variable management for Node.js runtime configuration

## Important Patterns and Conventions

### Test Isolation
- Session-specific identifiers prevent test interference
- Environment variable preservation/restoration pattern
- Mock lifecycle management with proper cleanup

### Platform Compatibility
- Conditional path handling for Windows vs Unix systems
- Normalized path assertions for cross-platform validation
- Runtime detection and configuration flexibility

### Integration Testing Philosophy
- Smoke testing approach focusing on critical integration points
- Real adapter factory usage rather than extensive mocking
- End-to-end validation of adapter command generation pipeline