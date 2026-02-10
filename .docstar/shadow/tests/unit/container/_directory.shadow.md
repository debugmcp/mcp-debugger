# tests/unit/container/
@generated: 2026-02-10T21:26:16Z

## Purpose
This directory contains unit tests for the dependency injection container system, specifically focused on testing the `createProductionDependencies` factory function that wires together the core services and adapters of the application.

## Key Components
- **dependencies.test.ts**: Comprehensive test suite for dependency injection container factory
- **Mock Infrastructure**: Extensive mocking system covering all core services, factories, adapters, and utilities
- **Environment Management**: Test utilities for managing process environment and global state

## Testing Focus Areas

### Core Dependency Injection
Tests the proper wiring and instantiation of the complete service dependency graph including:
- Core services (FileSystem, ProcessManager, NetworkManager, Launcher)
- Factory components (ProxyManagerFactory, SessionStoreFactory)
- Cross-cutting concerns (Logger configuration, AdapterRegistry setup)

### Adapter System Integration
Validates the dynamic adapter registration system:
- Bundled adapter loading from global state (`__DEBUG_MCP_BUNDLED_ADAPTERS__`)
- Async adapter registration with error handling
- Container environment filtering (MCP_CONTAINER=true behavior)
- Language-specific adapter enablement/disablement

### Environment Configuration
Tests container behavior under different runtime conditions:
- Process environment variable handling
- Container vs non-container execution modes
- Language configuration and filtering

## Test Architecture Patterns

### Mock Strategy
- **Complete Service Mocking**: All dependencies mocked to isolate container logic
- **Custom Mock Classes**: Specialized mocks like AdapterRegistryMock for complex behaviors
- **Global State Management**: Controlled testing of bundled adapters via globalThis

### Test Isolation
- **Environment Backup/Restore**: Preserves and restores process.env state
- **Mock Reset**: Comprehensive mock clearing between test runs
- **Async Error Testing**: Proper async error handling validation

## Public Testing Interface
The test suite validates the public contract of:
- `createProductionDependencies()` factory function
- Proper service instantiation and wiring
- Adapter registration and filtering behavior
- Environment-aware configuration loading

This test directory ensures the dependency injection container correctly assembles the application's service layer and properly handles various deployment scenarios including containerized environments and different language adapter configurations.