# tests/unit/container/
@generated: 2026-02-10T01:19:36Z

## Purpose
This directory contains unit tests for the dependency injection container system, specifically focused on testing the `createProductionDependencies` factory function that wires together the application's core services and adapters.

## Key Components
- **dependencies.test.ts**: Comprehensive test suite for dependency container initialization, service wiring, and adapter management

## Testing Scope
The tests validate three critical aspects of the container system:

1. **Core Service Wiring**: Ensures proper dependency injection creates a complete object graph with correctly configured services (FileSystem, ProcessManager, NetworkManager, Launcher) and supporting components (Logger, ProxyManagerFactory, SessionStoreFactory)

2. **Adapter Registration**: Tests the async loading and registration of bundled adapters through a global registry mechanism, including error handling for failed adapter initialization

3. **Environment-Aware Filtering**: Validates conditional adapter loading based on container environment settings and language configuration

## Mock Infrastructure
Extensive mock setup covering:
- All core service implementations and their instances
- Logger factory and methods
- Adapter registry with registration and language support capabilities
- Configuration utilities for language filtering
- Global state management for bundled adapter testing

## Key Testing Patterns
- **Environment Isolation**: Careful management of process.env and global state to prevent test interference
- **Async Error Testing**: Proper testing of Promise-based adapter loading with error scenarios
- **Mock Lifecycle Management**: Comprehensive setup/teardown ensuring clean test state
- **Global State Testing**: Uses `__DEBUG_MCP_BUNDLED_ADAPTERS__` global key for bundled adapter configuration testing

## Public API Coverage
Tests focus on the main entry point `createProductionDependencies()` function, validating its ability to:
- Create properly wired service instances
- Configure logging infrastructure
- Initialize adapter registry with appropriate settings
- Handle both successful and failed adapter registration scenarios
- Respect environment-based adapter filtering

This test suite ensures the dependency container correctly bootstraps the entire application service layer with proper error handling and environment awareness.