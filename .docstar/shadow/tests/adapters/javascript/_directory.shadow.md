# tests\adapters\javascript/
@generated: 2026-02-12T21:05:55Z

## Purpose and Responsibility

The `tests/adapters/javascript` directory provides comprehensive integration testing for the JavaScript/TypeScript debug adapter, focusing on validating critical adapter functionality through smoke tests and ensuring cross-platform compatibility. This testing module serves as the primary validation layer for JavaScript adapter integration within the broader debug system.

## Key Components and Relationships

### Integration Test Suite
The directory centers around integration smoke tests that validate end-to-end adapter functionality rather than isolated unit behaviors. The test suite focuses on three core integration areas that work together to ensure proper adapter operation:

- **Session Management**: Validates adapter lifecycle, registry integration, and session isolation
- **Configuration Transformation**: Tests TypeScript/JavaScript configuration handling and launch setup
- **Command Generation**: Verifies debug server command construction and execution preparation

### Cross-Platform Support Infrastructure
A comprehensive platform compatibility layer ensures tests run reliably across Windows and Unix systems through:
- Platform detection and path normalization utilities
- Environment variable management for Node.js runtime configuration
- Conditional path handling for consistent cross-platform assertions

## Public API Surface

### Primary Test Entry Points
- **JavaScript Session Smoke Test**: Main integration validation covering complete adapter workflow from registration through command generation
- **Platform Compatibility Layer**: Utilities for cross-platform path handling and environment management

### Validated Integration Points
The tests validate key adapter API surfaces including:
- `JavascriptAdapterFactory` registration and configuration patterns
- `transformLaunchConfig` functionality for TypeScript session setup
- `buildAdapterCommand` for debug server initialization
- Adapter registry integration and session management

## Internal Organization and Data Flow

### Test Execution Pipeline
1. **Environment Setup**: Preserve system state, initialize adapter registry, configure test isolation
2. **Adapter Integration**: Register JavaScript adapter factory, transform configurations, build debug commands
3. **Validation**: Assert proper command generation, configuration transformation, and session handling
4. **Cleanup**: Restore environment state, clear registry, reset mocks

### Cross-Platform Strategy
The testing infrastructure employs a multi-layered approach to ensure platform compatibility:
- Runtime detection for appropriate Node.js executable selection
- Path normalization for consistent file system interaction
- Environment variable isolation to prevent test interference

## Important Patterns and Conventions

### Integration Testing Philosophy
- **Smoke Testing Approach**: Focus on critical integration points rather than exhaustive edge case coverage
- **Real Component Usage**: Minimize mocking in favor of actual adapter factory and registry interaction
- **End-to-End Validation**: Test complete workflows from adapter registration through debug command generation

### Test Isolation and Reliability
- Session-specific identifiers prevent cross-test interference
- Environment preservation/restoration patterns ensure clean test state
- Platform-aware assertions accommodate different operating system behaviors

### Configuration and Runtime Management
- TypeScript runtime detection with tsx fallback support
- Debug server port configuration and endpoint validation
- Absolute path resolution for reliable adapter command construction