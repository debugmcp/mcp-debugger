# tests/unit/container/dependencies.test.ts
@source-hash: 0da1d12238b5e363
@generated: 2026-02-10T00:41:32Z

## Purpose
Unit test file for the dependency injection container factory function `createProductionDependencies`. Tests wiring of core services, bundled adapter registration, and conditional adapter loading in container environments.

## Key Test Structure
- **Mock Setup (L3-65)**: Extensive mocking of all dependencies including logger, implementations, factories, and adapter registry
- **Test Environment Management (L68-86)**: Manages process.env state and bundled adapters global key
- **Main Test Suite (L88-186)**: Three test cases covering core functionality

## Mock Infrastructure
- **Service Instance Mocks (L8-15)**: Mock objects representing filesystem, process manager, network manager, and launcher instances
- **Logger Mock (L3-6, L20-22)**: Mocked createLogger function with info/warn methods
- **Implementation Mocks (L24-31)**: All core service implementations (FileSystem, ProcessManager, etc.)
- **Factory Mocks (L38-45)**: ProxyManagerFactory and SessionStoreFactory mocks
- **AdapterRegistryMock Class (L47-58)**: Custom mock class with register and getSupportedLanguages methods
- **Language Config Mock (L60-64)**: Mocks isLanguageDisabled utility function

## Test Cases
1. **Core Wiring Test (L89-124)**: Verifies dependency injection creates proper object graph with correct logger configuration and adapter registry settings
2. **Bundled Adapter Registration (L126-165)**: Tests async adapter registration with error handling, using globalThis bundled adapters array
3. **Container Environment Filtering (L167-185)**: Tests adapter skipping when MCP_CONTAINER=true and language is disabled

## Key Constants
- **BUNDLED_ADAPTERS_KEY (L69)**: Global key `__DEBUG_MCP_BUNDLED_ADAPTERS__` for storing bundled adapter configurations
- **Environment Backup (L68)**: Preserves original process.env for test isolation

## Critical Test Patterns
- Comprehensive mock reset in beforeEach (L71-81)
- Environment restoration in afterEach (L83-86)  
- Async error testing with Promise.resolve() timing (L160)
- Global state management for bundled adapters testing