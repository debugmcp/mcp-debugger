# tests/test-utils/mocks/dap-client.ts
@source-hash: be07f8ecbcb40525
@generated: 2026-02-09T18:14:39Z

## Purpose
Mock implementation of the Debug Adapter Protocol (DAP) client for consistent testing across debugger test suites. Provides controlled simulation of DAP client behavior, event handling, and error scenarios.

## Key Components

### DapEvent Type (L12-31)
Union type defining all supported DAP events including lifecycle events (`initialized`, `stopped`, `continued`), debugging events (`breakpoint`, `output`), and progress events (`progressStart`, `progressUpdate`, `progressEnd`).

### MockDapClient Class (L36-121)
Core mock client extending EventEmitter with vitest-mocked methods:

**Core DAP Methods:**
- `connect` (L38): Mock connection method, resolves to undefined by default
- `disconnect` (L39): Mock disconnection method, resolves to undefined by default  
- `sendRequest` (L40): Mock request sender, resolves to empty object by default

**Event Tracking:**
- `eventHandlers` Map (L43): Tracks registered event handlers by event type
- Overridden `on` method (L49-56): Wraps EventEmitter.on with mock tracking

**Testing Utilities:**
- `reset()` (L62-75): Clears all mocks, handlers, and resets to default state
- `mockRequest()` (L80-87): Sets specific response for given command
- `simulateEvent()` (L92-94): Triggers DAP events with optional data
- `simulateRequestError()` (L99-106): Makes specific command reject with error
- `simulateConnectionError()` (L111-113): Makes next connection attempt fail
- `getEventHandlers()` (L118-120): Returns handlers registered for specific event

## Exports and Usage

**Singleton Instance (L124):**
- `mockDapClient`: Ready-to-use instance for tests

**Helper Functions:**
- `resetMockDapClient()` (L127-129): Resets singleton state

**Default Export (L132-134):**
- Mock factory for `vi.mock()` usage, returns constructor that creates singleton instance

## Architecture Patterns
- **Singleton Pattern**: Single shared instance across tests for consistency
- **Mock Strategy**: Uses vitest mocks for method spying and behavior control
- **Event Simulation**: Leverages EventEmitter for realistic event-driven testing
- **State Management**: Comprehensive reset mechanism for test isolation