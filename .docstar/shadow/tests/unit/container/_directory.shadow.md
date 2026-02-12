# tests\unit\container/
@generated: 2026-02-12T21:05:39Z

## Purpose
This directory contains unit tests for the dependency injection container system, specifically testing the `createProductionDependencies` factory function that wires together the core application services and manages adapter registration.

## Key Components and Integration
- **Container Factory Testing**: Validates the dependency injection system that creates and connects core services (FileSystem, ProcessManager, NetworkManager, Launcher)
- **Adapter Management Testing**: Tests both bundled adapter registration and conditional adapter loading based on environment configuration
- **Mock Infrastructure**: Comprehensive mocking system covering all service dependencies, factories, and external utilities

## Test Coverage Areas
The test suite validates three critical aspects of the container system:

1. **Core Service Wiring**: Ensures the dependency injection creates proper object graphs with correct logger configuration and adapter registry integration
2. **Bundled Adapter Registration**: Tests asynchronous adapter loading from global bundled adapter configurations with proper error handling
3. **Environment-Based Filtering**: Validates conditional adapter loading when running in container environments (`MCP_CONTAINER=true`) with language-specific filtering

## Testing Patterns and Infrastructure
- **Extensive Mock Setup**: All dependencies are mocked to ensure isolated unit testing of container logic
- **Environment State Management**: Careful preservation and restoration of process.env and global state
- **Async Error Testing**: Proper testing of asynchronous adapter registration with error scenarios
- **Global State Handling**: Management of bundled adapter configurations via `globalThis.__DEBUG_MCP_BUNDLED_ADAPTERS__`

## Key Entry Points
The primary test target is the `createProductionDependencies` function, which serves as the main entry point for dependency injection in the production application. The tests validate that this factory correctly:
- Instantiates and wires core services
- Configures logging across all components
- Registers adapters from various sources
- Applies environment-specific filtering rules

This test directory ensures the reliability of the application's dependency injection and service composition system, which is critical for proper application bootstrapping and runtime behavior.