# tests/test-utils/helpers/test-setup.ts
@source-hash: d1b6360bcc3cf79f
@generated: 2026-02-10T00:41:30Z

## Test Setup Utilities

This module provides factory functions for creating test instances with mock dependencies, specifically focused on SessionManager and related components. Serves as the primary entry point for setting up isolated test environments.

### Core Factory Functions

**createTestSessionManager** (L30-66) - Main factory function that creates a SessionManager instance with configurable mock dependencies. Returns the manager, dependencies object, and typed mock factories. Automatically creates mock environment if not provided (L42-46).

**createTestSessionStore** (L72-80) - Creates a SessionStore instance via MockSessionStoreFactory. Simple factory without configuration options.

**createTestSessionManagerWithProxyManager** (L120-143) - Specialized factory that injects a specific MockProxyManager instance into a SessionManager. Overrides the factory's create method to return the provided mock (L132).

### Mock Creation Utilities

**createMockProxyManager** (L87-114) - Creates a preconfigured MockProxyManager with optional state setup. Can simulate running state via start() call (L96-106) and set thread ID via simulateStopped() (L108-111).

**createMockFileSystemWithDefaults** (L148-159) - Creates mock FileSystem with common test behaviors pre-configured (pathExists=true, file operations mocked).

**createMockNetworkManagerWithDefaults** (L164-172) - Creates mock NetworkManager with incrementing port allocation behavior starting at 5678.

### Test Utilities

**waitForEvent** (L177-192) - Promise-based event waiter with timeout support. Generic utility for async event testing.

**simulateProxyManagerLifecycle** (L197-212) - Orchestrates typical ProxyManager initialization sequence with configurable stop-on-entry behavior. Uses setTimeout for async simulation.

### Key Dependencies

- Imports from `test-dependencies.js` for base mock creation
- Uses Vitest mocking (`vi.fn()`) throughout
- Integrates with SessionManager, MockProxyManager, and factory classes
- Environment mocking defaults to process.env wrapper (L42-46)

### Architecture Pattern

Follows dependency injection pattern where overrides merge with defaults. All factory functions return both the instance and its dependencies for test introspection and further mocking.