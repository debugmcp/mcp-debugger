# tests/adapters/javascript/integration/
@generated: 2026-02-10T01:19:35Z

## Purpose and Responsibility

Integration test module for the JavaScript adapter functionality within the broader adapter system. This directory contains smoke tests that validate the end-to-end behavior of JavaScript/TypeScript debugging adapters, focusing on session management, configuration transformation, and command generation for the tsx runtime environment.

## Key Components and Architecture

### Test Infrastructure
- **Cross-platform compatibility**: Platform detection and path normalization utilities to handle Windows vs Unix file system differences
- **Environment isolation**: Systematic preservation and restoration of NODE_OPTIONS and adapter registry state between tests
- **Mock management**: Clean setup/teardown of mocks to prevent test interference

### Core Integration Points
- **Adapter Registration**: Tests the registration and configuration of JavascriptAdapterFactory within the adapter registry system
- **Launch Configuration**: Validates the transformation of launch configurations, particularly tsx runtime executable handling
- **Command Generation**: Verifies the building of adapter commands with correct paths and port configurations

## Public API Surface

The tests exercise these key adapter system entry points:
- `AdapterRegistry.register()` - Adapter registration with validation controls
- `adapter.transformLaunchConfig()` - Launch configuration transformation with runtime overrides
- `adapter.buildAdapterCommand()` - Command generation for debug server execution

## Internal Organization and Data Flow

1. **Setup Phase**: Environment preservation → Registry reset → Mock clearing → Adapter registration
2. **Configuration Phase**: Session parameter setup → TypeScript file path configuration → Launch config transformation
3. **Validation Phase**: Command building → Path validation → Port verification → Runtime configuration assertions
4. **Teardown Phase**: Environment restoration → Registry cleanup → Mock restoration

## Important Patterns and Conventions

- **Test Isolation**: Each test preserves and restores global state to prevent cross-test pollution
- **Platform Agnostic**: Consistent use of path normalization for cross-platform reliability
- **Smoke Testing Approach**: Focus on critical integration points rather than exhaustive unit testing
- **Type Flexibility**: Strategic use of type assertions (`as any`) to accommodate adapter interface variations
- **Session-based Testing**: Use of unique session identifiers (`session-js-3`) for test isolation

## Integration Context

This module validates that the JavaScript adapter correctly integrates with:
- The adapter registry system for dynamic adapter loading
- The debug server infrastructure via `js-debug/vsDebugServer.cjs`
- TypeScript execution environments through tsx runtime configuration
- Cross-platform file system handling for development workflow compatibility