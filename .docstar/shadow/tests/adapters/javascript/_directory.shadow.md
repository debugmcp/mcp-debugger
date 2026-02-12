# tests/adapters/javascript/
@generated: 2026-02-11T23:47:46Z

## Purpose and Responsibility

The JavaScript adapter test suite validates the core functionality and integration points of the JavaScript debugging adapter. This directory contains comprehensive integration tests that ensure the adapter properly handles TypeScript execution, session management, and command generation while maintaining cross-platform compatibility.

## Key Components and Organization

### Integration Test Suite
The primary component is a comprehensive integration test suite focusing on:
- **TypeScript Runtime Integration**: Validates tsx runtime configuration and execution
- **Session Management**: Tests isolated session handling and lifecycle management
- **Command Generation**: Verifies adapter command building with correct paths and ports
- **Cross-Platform Support**: Ensures consistent behavior across Windows and Unix environments

### Test Architecture
- **Smoke Testing Approach**: Focuses on critical integration points rather than exhaustive unit testing
- **Environment Isolation**: Preserves and restores test environment state between runs
- **Platform Abstraction**: Handles OS-specific path conventions and configurations transparently

## Public API Surface

### Main Test Entry Points
- **Integration Test Suite**: Validates adapter registration and configuration transformation
- **Session-Based Testing**: Uses isolated session IDs for test independence
- **Configuration Validation**: Tests launch configuration transformation with tsx runtime
- **Command Building Tests**: Validates adapter command structure and path resolution

### Key Validation Targets
- `transformLaunchConfig`: Ensures proper tsx runtime executable configuration
- `buildAdapterCommand`: Validates adapter command structure with correct paths and ports
- Cross-platform path normalization and absolute path resolution

## Internal Organization and Data Flow

### Test Lifecycle Management
1. **Setup Phase**: Environment preservation, adapter registry creation, and factory registration
2. **Execution Phase**: Configuration testing and command generation validation
3. **Cleanup Phase**: Environment restoration and registry cleanup

### Integration Flow
- Adapter factory registration with the adapter registry system
- Launch configuration transformation testing with TypeScript support
- Command generation validation with host/port configuration (localhost:56789)
- Cross-platform path handling and normalization

## Important Patterns and Conventions

### Testing Philosophy
- **Integration-Focused**: Tests real adapter behavior rather than mocked components
- **Platform Agnostic**: Handles different OS environments without test duplication
- **Environment Safe**: Preserves system state and provides proper cleanup

### Architectural Integration Points
- Works with the broader adapter-registry system for factory management
- Validates integration with js-debug VSCode extension backend
- Tests tsx runtime integration for seamless TypeScript debugging support

This test directory serves as the quality gate ensuring the JavaScript adapter maintains reliable integration with the debugging infrastructure while supporting modern TypeScript development workflows across all supported platforms.