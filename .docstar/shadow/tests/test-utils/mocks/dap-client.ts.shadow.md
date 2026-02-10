# tests/test-utils/mocks/dap-client.ts
@source-hash: be07f8ecbcb40525
@generated: 2026-02-10T00:41:30Z

**Purpose**: Mock implementation of Debug Adapter Protocol (DAP) client for comprehensive debugger testing. Provides controlled simulation of DAP communication patterns, event handling, and error scenarios.

## Core Architecture

**MockDapClient Class (L36-121)**: Extends EventEmitter to simulate DAP client behavior with Vitest mocks. Key features:
- Mocked connection lifecycle methods: `connect()`, `disconnect()` (L38-39)
- Generic request handler: `sendRequest()` (L40) - returns empty object by default
- Event handler tracking via private `eventHandlers` Map (L43)
- Overridden `on()` method (L49-56) to track registered event listeners

## Key Methods

**State Management**:
- `reset()` (L62-75): Clears all mocks, event handlers, and listeners; restores default implementations
- `getEventHandlers()` (L118-120): Retrieves registered handlers for specific events

**Request Simulation**:
- `mockRequest()` (L80-87): Configure custom responses for specific DAP commands
- `simulateRequestError()` (L99-106): Inject errors for specific command types

**Event & Error Simulation**:
- `simulateEvent()` (L92-94): Trigger DAP events with optional data payloads
- `simulateConnectionError()` (L111-113): Simulate connection failures

## Type System

**DapEvent Type Union (L12-31)**: Comprehensive enumeration of DAP event types including lifecycle events (`initialized`, `terminated`), debugging events (`stopped`, `breakpoint`), and progress events (`progressStart`, `progressUpdate`, `progressEnd`).

## Exports & Usage

**Singleton Instance**: `mockDapClient` (L124) - shared instance for test consistency
**Reset Helper**: `resetMockDapClient()` (L127-129) - convenience function for test cleanup
**Default Export** (L132-134): vi.mock-compatible factory returning the singleton instance

## Dependencies

- **vitest**: Mock function creation and management
- **events.EventEmitter**: Event emission and handling infrastructure

## Testing Patterns

The mock supports comprehensive DAP testing scenarios:
- Connection lifecycle testing
- Request/response pattern verification
- Event-driven behavior validation
- Error condition simulation
- Handler registration tracking