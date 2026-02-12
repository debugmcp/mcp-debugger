# tests/adapters/javascript/integration/
@generated: 2026-02-11T23:47:35Z

## Purpose and Responsibility

Integration test suite for the JavaScript adapter, focusing on smoke testing core functionality including TypeScript configuration handling, session management, and adapter command generation with tsx runtime support.

## Key Components and Organization

### Test Structure
The directory contains integration smoke tests that validate the JavaScript adapter's ability to:
- Handle TypeScript configuration and runtime execution
- Generate proper launch configurations with tsx runtime
- Build correct adapter commands with appropriate paths and ports
- Manage cross-platform compatibility (Windows/Unix path handling)

### Core Test Flow
1. **Environment Setup**: Platform-specific configuration with session isolation
2. **Adapter Registration**: Creates registry and registers JavascriptAdapterFactory
3. **Configuration Testing**: Validates launch config transformation with tsx runtime
4. **Command Generation**: Tests adapter command building with correct paths and ports

## Public Integration Points

### Test Configuration Entry Points
- Session-based testing with isolated session IDs (`session-js-3`)
- TypeScript file path handling with platform detection
- Adapter host/port configuration (localhost:56789)

### Validation Targets
- **transformLaunchConfig**: Ensures proper tsx runtime executable configuration
- **buildAdapterCommand**: Validates adapter command structure and paths
- Cross-platform path normalization and absolute path resolution

## Internal Organization and Data Flow

### Test Lifecycle Management
- Environment preservation and restoration (NODE_OPTIONS)
- Adapter registry cleanup and mock management
- Session isolation through beforeEach/afterEach hooks

### Cross-Platform Compatibility
- Platform detection for Windows vs Unix environments
- Path normalization utilities for consistent assertions
- Flexible type handling with strategic type assertions

## Important Patterns and Conventions

### Testing Approach
- **Smoke Testing**: Focuses on key integration points rather than exhaustive coverage
- **Platform Agnostic**: Handles different OS path conventions transparently  
- **Environment Isolation**: Preserves and restores test environment state

### Architectural Integration
- Works with adapter-registry system for factory registration
- Validates integration with js-debug VSCode extension backend
- Tests tsx runtime integration for TypeScript execution

This integration test suite serves as a critical validation layer ensuring the JavaScript adapter properly integrates with the broader debugging infrastructure while maintaining cross-platform compatibility.