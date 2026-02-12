# tests/unit/container/
@generated: 2026-02-11T23:47:33Z

## Purpose
This directory contains unit tests for the dependency injection container system, specifically testing the `createProductionDependencies` factory function that wires together all core services, adapters, and configurations for the MCP (Model Context Protocol) system.

## Key Components and Organization
The test suite focuses on validating three critical aspects of the dependency injection container:

1. **Core Service Wiring**: Tests that all fundamental services (filesystem, process manager, network manager, launcher) are properly instantiated and connected through the dependency injection system
2. **Adapter Registration**: Validates the asynchronous loading and registration of bundled language adapters from the global adapter registry
3. **Environment-Aware Filtering**: Tests conditional adapter loading based on container environment settings and language enablement flags

## Mock Infrastructure
The tests employ comprehensive mocking to isolate the container logic:
- **Service Layer Mocks**: All core implementation classes (FileSystem, ProcessManager, NetworkManager, etc.)
- **Factory Mocks**: ProxyManagerFactory and SessionStoreFactory for service creation
- **Registry Mock**: Custom AdapterRegistryMock class simulating language adapter registration
- **Configuration Mocks**: Logger factory and language configuration utilities
- **Global State Management**: Handles `__DEBUG_MCP_BUNDLED_ADAPTERS__` global key for bundled adapter testing

## Test Patterns and Critical Functionality
The test suite follows rigorous patterns for reliability:
- **Environment Isolation**: Preserves and restores `process.env` state across test runs
- **Mock State Management**: Comprehensive reset of all mocks between tests
- **Async Error Testing**: Validates error handling in adapter registration workflows
- **Container Environment Detection**: Tests `MCP_CONTAINER=true` environment behavior

## Public API Coverage
Tests validate the primary entry point `createProductionDependencies()` function, ensuring it:
- Returns a properly configured dependency container with all services wired
- Handles bundled adapter registration asynchronously with error resilience
- Respects environment-based filtering for container deployments
- Maintains proper logger configuration throughout the dependency graph

## Data Flow Validation
The tests verify the complete dependency injection flow from factory function invocation through service instantiation, adapter registration, and final container assembly, ensuring all components are properly connected and configured for production use.