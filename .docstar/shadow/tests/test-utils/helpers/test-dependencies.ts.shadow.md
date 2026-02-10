# tests/test-utils/helpers/test-dependencies.ts
@source-hash: c86d125ca505de13
@generated: 2026-02-09T18:14:42Z

## Primary Purpose
Test utilities file providing mock dependencies and test server creation for the DebugMCP test suite. Centralizes all test-only dependency injection patterns and provides both fake implementations and Vitest mock objects.

## Key Functions & Interfaces

### Core Factory Functions
- **`createTestServer(options)`** (L32-40): Creates DebugMcpServer configured for testing with 'error' log level default
- **`createTestDependencies()`** (L66-95): Async factory returning complete Dependencies with fake implementations (imports from test/fake-process-launcher)
- **`createMockDependencies()`** (L119-144): Sync factory returning Dependencies with vi.fn() mocks for all methods
- **`createMockSessionManagerDependencies()`** (L101-112): Factory for SessionManager-specific dependency container

### Dependency Container Interface
- **`Dependencies`** (L45-60): Complete application dependency interface covering core implementations, process launchers, and factories

### Mock Creation Helpers (L148-215)
Individual mock creators for each interface type:
- **`createMockLogger()`** (L148-155): ILogger with vi.fn() methods
- **`createMockFileSystem()`** (L157-175): IFileSystem with comprehensive file operation mocks
- **`createMockProcessManager()`** (L177-182): IProcessManager with spawn/exec mocks
- **`createMockNetworkManager()`** (L184-189): INetworkManager with findFreePort defaulting to 5678
- **`createMockProcessLauncher()`** (L191-195): IProcessLauncher mock
- **`createMockProxyProcessLauncher()`** (L197-201): IProxyProcessLauncher mock
- **`createMockDebugTargetLauncher()`** (L203-207): IDebugTargetLauncher mock
- **`createMockEnvironment()`** (L209-215): IEnvironment mock delegating to process.env

### Advanced Registry Factory
- **`createFullAdapterRegistry()`** (L222-239): Async factory creating real adapter registry with Python and Mock adapters registered

## Key Dependencies
- Vitest framework (vi) for mocking
- External dependency interfaces from `src/interfaces/`
- Process interfaces from `src/interfaces/process-interfaces.js`
- Mock implementations from local mocks and factories
- Real adapter implementations (@debugmcp/adapter-python, @debugmcp/adapter-mock)

## Architectural Patterns
- **Dependency Injection**: Provides multiple strategies (fakes vs mocks) for test isolation
- **Factory Pattern**: Consistent creation functions for different testing scenarios
- **Interface Segregation**: Separate mock creators for each interface type
- **Dynamic Imports**: Uses async imports to avoid require() and manage optional dependencies

## Critical Constraints
- **Test-only usage**: Explicitly documented as DO NOT import in production (L2)
- **Mock vs Fake distinction**: `createTestDependencies()` uses fake implementations, `createMockDependencies()` uses vi.fn() mocks
- **Default test configuration**: Test server defaults to 'error' log level for noise reduction