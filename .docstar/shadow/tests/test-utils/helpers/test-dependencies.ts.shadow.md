# tests/test-utils/helpers/test-dependencies.ts
@source-hash: c86d125ca505de13
@generated: 2026-02-10T00:41:33Z

## Purpose
Test utility module providing factory functions and mock implementations for creating isolated test environments. Centralizes test dependency creation to avoid production code contamination.

## Key Exports

### Factory Functions
- `createTestServer(options)` (L32-40): Creates DebugMcpServer with test-safe configuration (defaults to 'error' log level)
- `createTestDependencies()` (L66-95): Async factory returning complete dependency container with fake implementations from test modules
- `createMockDependencies()` (L119-144): Synchronous factory returning dependencies with vi.fn() mocks for all methods
- `createMockSessionManagerDependencies()` (L101-112): Specialized factory for SessionManager testing with all required dependencies
- `createFullAdapterRegistry()` (L222-238): Creates populated adapter registry with Python and Mock adapters

### Mock Creators (L148-215)
Individual mock factories for each interface:
- `createMockLogger()`, `createMockFileSystem()`, `createMockProcessManager()`, `createMockNetworkManager()`
- `createMockProcessLauncher()`, `createMockProxyProcessLauncher()`, `createMockDebugTargetLauncher()`
- `createMockEnvironment()`: Delegates to actual process.env

### Type Definition
- `Dependencies` interface (L45-60): Complete dependency container type covering all core implementations, process launchers, and factories

## Architecture Patterns
- **Dependency Injection**: Provides complete dependency containers for isolated testing
- **Factory Pattern**: Multiple factory functions for different testing scenarios (fake vs mock implementations)
- **Interface Compliance**: All mocks implement production interfaces ensuring type safety
- **Dynamic Imports**: Uses async imports to avoid circular dependencies and enable lazy loading

## Key Dependencies
- Vitest (`vi`) for mock functions
- Production interfaces from `src/interfaces/` for type compliance
- Fake implementations from `tests/implementations/test/`
- Mock factories from `src/factories/`
- Adapter packages for full registry testing

## Testing Strategy
- **Fake vs Mock**: `createTestDependencies()` uses fake implementations, `createMockDependencies()` uses vi.fn() spies
- **Isolation**: Each factory creates fresh instances preventing test pollution
- **Completeness**: Covers all application dependencies ensuring comprehensive test coverage