# tests/adapters/javascript/integration/
@generated: 2026-02-09T18:16:01Z

## Purpose
Integration testing module for the JavaScript adapter functionality, providing smoke tests to validate the complete workflow from adapter configuration to command building. This directory ensures the JavaScript adapter can properly transform launch configurations and generate debugging commands in a real integration environment.

## Key Components
- **javascript-session-smoke.test.ts**: Primary integration smoke test validating JavaScript adapter session management, configuration transformation, and command generation

## Test Coverage & Responsibilities
The integration tests focus on end-to-end validation of:
- **Session Configuration**: Cross-platform session setup with localhost adapter on port 56789
- **Launch Config Transformation**: tsx runtime override handling and runtime argument validation  
- **Adapter Command Building**: js-debug vendor path resolution and absolute path requirements
- **Platform Compatibility**: Windows and Unix path handling normalization

## Test Architecture
- **Environment Management**: Preserves and restores NODE_OPTIONS environment variables
- **Registry Integration**: Tests adapter registration and configuration with validation disabled
- **Mock Management**: Comprehensive setup/teardown of mock states for isolated testing
- **Cross-Platform Support**: Platform detection and path normalization utilities

## Integration Points
The tests validate integration between:
- **JavascriptAdapterFactory**: Core adapter implementation
- **Adapter Registry**: Central registry system for adapter management
- **Platform Detection**: OS-specific path and configuration handling
- **Debug Runtime**: tsx executable configuration and js-debug vendor script integration

## Test Patterns
- **Smoke Testing**: Lightweight integration validation focusing on critical path functionality
- **Configuration Validation**: Ensures proper parameter propagation and transformation
- **Path Resolution**: Validates absolute path requirements and vendor script locations
- **Environment Isolation**: Clean test state management with proper setup/teardown

## Key Assertions
Tests verify that the JavaScript adapter can successfully:
- Transform launch configurations with runtime overrides
- Generate proper adapter commands with correct paths
- Handle cross-platform path differences
- Maintain proper port and session configuration