# tests\unit\container/
@children-hash: 0dad05017ae45820
@generated: 2026-02-15T09:01:19Z

## Purpose
Unit test directory for the dependency injection container system. Contains comprehensive tests for the `createProductionDependencies` factory function, which serves as the main entry point for wiring together all core services, adapters, and dependencies in the MCP (Model Control Protocol) system.

## Key Components

### Test Infrastructure
- **Extensive Mock System**: Complete mocking infrastructure covering all service layers including filesystem, process management, network operations, and session handling
- **Environment Management**: Sophisticated test environment setup that manages `process.env` state and global adapter registry for isolated testing
- **Async Testing Patterns**: Handles complex asynchronous adapter loading and error scenarios with proper timing controls

### Core Test Coverage
- **Dependency Wiring**: Validates the complete object graph creation with proper logger configuration and service interconnections
- **Adapter Management**: Tests dynamic adapter registration system, including bundled adapters and language-specific filtering
- **Container Environment Handling**: Verifies conditional behavior in containerized deployments (MCP_CONTAINER environment)

## Public API Surface
The tests validate the main entry point:
- `createProductionDependencies()`: Factory function that returns fully configured dependency injection container with all services wired

## Internal Organization
The test suite follows a layered approach:
1. **Mock Layer**: Comprehensive mocking of all external dependencies and services
2. **Environment Layer**: Test environment setup and teardown with state isolation
3. **Integration Layer**: Tests that validate the complete system wiring and behavior

## Data Flow
Tests verify the dependency injection flow:
1. Container factory creates service instances with proper logger injection
2. Adapter registry gets populated with available language adapters
3. Environment-specific filtering applies (container vs non-container deployments)
4. Error handling ensures graceful degradation when adapters fail to load

## Important Patterns
- **Global State Management**: Uses `globalThis.__DEBUG_MCP_BUNDLED_ADAPTERS__` for testing bundled adapter scenarios
- **Environment Isolation**: Careful management of process.env changes with proper cleanup
- **Mock Reset Pattern**: Comprehensive mock clearing between tests to prevent state leakage
- **Async Error Testing**: Sophisticated error scenario testing with Promise timing controls

This directory ensures the dependency injection system correctly integrates all components and handles various deployment scenarios reliably.