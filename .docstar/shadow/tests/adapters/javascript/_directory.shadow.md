# tests/adapters/javascript/
@generated: 2026-02-09T18:16:14Z

## Purpose
Integration testing module for JavaScript adapter functionality within the debugger system. This directory provides comprehensive smoke tests and integration validation to ensure the JavaScript adapter can properly handle end-to-end debugging workflows, from configuration transformation to command generation across different platforms.

## Key Components
- **integration/**: Primary integration test suite containing smoke tests for JavaScript adapter session management, configuration handling, and cross-platform compatibility validation

## Public API Surface
The integration tests validate the following key entry points and workflows:
- **JavascriptAdapterFactory**: Core adapter implementation and factory methods
- **Adapter Registry Integration**: Registration, configuration, and validation processes
- **Session Management**: Cross-platform session setup and configuration
- **Launch Configuration Transformation**: Runtime override processing and parameter validation
- **Command Building**: Debug command generation with proper vendor script resolution

## Internal Organization & Data Flow
The testing flow follows this pattern:
1. **Environment Setup**: Preserve system state and configure test environment
2. **Registry Integration**: Register JavaScript adapter with validation disabled for testing
3. **Configuration Processing**: Transform launch configurations with runtime overrides (tsx)
4. **Command Generation**: Build adapter commands with absolute path resolution
5. **Cross-Platform Validation**: Test Windows and Unix path handling normalization
6. **Cleanup**: Restore environment state and clear mock configurations

## Integration Points & Architecture
The tests validate integration between multiple system components:
- **Platform Detection System**: OS-specific path and configuration handling
- **Adapter Registry**: Central management system for adapter lifecycle
- **Debug Runtime Integration**: tsx executable configuration and js-debug vendor script coordination
- **Session Management**: Port configuration (localhost:56789) and session state handling

## Testing Patterns & Conventions
- **Smoke Testing Approach**: Lightweight integration validation focusing on critical path functionality
- **Environment Isolation**: Comprehensive setup/teardown with NODE_OPTIONS preservation
- **Cross-Platform Support**: Platform detection utilities and path normalization
- **Mock Management**: Clean test state with proper isolation between test runs
- **Configuration Validation**: End-to-end parameter propagation and transformation verification

## Key Validation Areas
The integration tests ensure the JavaScript adapter can:
- Successfully transform launch configurations with runtime overrides
- Generate proper adapter commands with correct absolute paths
- Handle cross-platform path differences seamlessly
- Maintain proper port configuration and session management
- Integrate correctly with the broader adapter registry system