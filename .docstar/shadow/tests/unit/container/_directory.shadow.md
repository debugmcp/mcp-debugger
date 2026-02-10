# tests/unit/container/
@generated: 2026-02-09T18:16:04Z

## Purpose
This directory contains unit tests for the container module's dependency injection system. The tests validate the production dependency container's initialization, service wiring, and adapter management capabilities to ensure proper system bootstrap in production environments.

## Key Components and Testing Strategy

### Production Dependency Container Testing
The primary focus is testing `createProductionDependencies`, the main entry point for production system initialization. Tests verify:
- **Service Instantiation**: Proper creation and wiring of core services (FileSystem, ProcessManager, NetworkManager, ProcessLauncher variants)
- **Factory Integration**: Correct initialization of ProxyManagerFactory and SessionStoreFactory
- **Configuration Propagation**: Proper passing of logger configuration (logLevel, logFile, loggerOptions)
- **Registry Setup**: AdapterRegistry configuration with production settings (validateOnRegister: false, allowOverride: false, enableDynamicLoading: true)

### Adapter Management Testing
Tests cover the container's adapter lifecycle management:
- **Bundled Adapter Registration**: Async registration of adapters defined in global `__DEBUG_MCP_BUNDLED_ADAPTERS__` key
- **Environment-based Filtering**: Container environment filtering using `MCP_CONTAINER=true` environment variable
- **Language Configuration**: Integration with language disable/enable configuration through `isLanguageDisabled`
- **Error Handling**: Graceful handling of adapter registration failures with logging

### Mock Infrastructure
Comprehensive mocking setup provides:
- **Service Mocks**: Tagged mock objects for all core services and factories
- **Registry Mock**: Full AdapterRegistry mock class with register/getSupportedLanguages methods
- **Environment Management**: Test isolation through process.env backup/restore
- **Logger Mocking**: Complete logger infrastructure mocking with info/warn methods

## Testing Patterns and Organization

### Test Structure
- **Setup Phase**: Extensive mock creation and environment preparation
- **Isolation**: BeforeEach/afterEach hooks ensuring clean test state
- **Scenario Coverage**: Three main test scenarios covering different aspects of dependency initialization
- **Async Testing**: Proper handling of async adapter registration and error scenarios

### Key Test Scenarios
1. **Core Wiring Test**: Validates basic dependency injection and service configuration
2. **Async Registration Test**: Tests bundled adapter registration with error handling
3. **Environment Filtering Test**: Verifies container-specific adapter filtering logic

## Dependencies and Integration Points
- **Core System**: Tests the integration between logger utils, implementations, and factory classes
- **Configuration System**: Validates language configuration integration for adapter filtering
- **Global State**: Tests interaction with global bundled adapter definitions
- **Environment Variables**: Validates environment-based behavior modification

This test suite serves as the validation layer for the container module's dependency injection system, ensuring reliable production initialization and proper service orchestration.