# tests/core/unit/session/session-manager-test-utils.ts
@source-hash: b6ebe9bb22327800
@generated: 2026-02-09T18:14:24Z

## Purpose
Provides centralized test utility functions and mocks for SessionManager unit tests, ensuring consistent test setup across all SessionManager test files.

## Key Components

### Mock Setup
- **vi.mock() for implementations** (L21-28): Mocks deprecated constructor path dependencies including FileSystemImpl, ProcessManagerImpl, NetworkManagerImpl, and various launcher implementations
- **vi.mock() for ProxyManager** (L30-39): Comprehensive mock with standard proxy lifecycle methods (start, stop, sendDapRequest, isRunning, getCurrentThreadId)

### Factory Functions

#### createMockEnvironment() (L44-50)
Creates IEnvironment mock with configurable overrides, defaults to process.env values. Supports get(), getAll(), and getCurrentWorkingDirectory() methods.

#### createMockAdapterRegistry() (L56-58) 
Thin wrapper around centralized mock factory to ensure consistency across tests.

#### createMockDependencies() (L63-121)
**Primary utility function** - constructs complete SessionManagerDependencies object with all required mocks:
- MockProxyManager instance (L70)
- File system, logger, environment mocks via helper functions (L71-73)
- NetworkManager mock with findFreePort returning 12345 (L75-78)
- ProxyManagerFactory mock (L80-82)
- SessionStoreFactory instance (L84)
- DebugTargetLauncher mock with Python debug target support (L86-92)
- PathUtils mock with cross-platform path operations (L94-101)
- AdapterRegistry mock (L103)

Returns extended type including both SessionManagerDependencies interface and individual mock instances for direct access in tests.

## Dependencies
- vitest for mocking framework
- SessionManager types and factories
- Centralized mock utilities from test-utils
- External dependency interfaces

## Architecture Notes
- Centralized mocking strategy prevents test coupling
- Extended return type allows both interface compliance and direct mock access
- Mock implementations provide realistic default behaviors (e.g., port 12345, PID 1234)
- Path utilities mock handles both Unix and Windows path formats