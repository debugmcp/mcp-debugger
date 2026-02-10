# tests/proxy/child-session-manager.test.ts
@source-hash: ebf486621af551c4
@generated: 2026-02-09T18:15:13Z

## Purpose
Test suite for `ChildSessionManager` class that validates child session management abstraction for debug adapters. Tests multi-session support, command routing, breakpoint mirroring, and policy-specific behaviors across JavaScript, Python, and default adapter policies.

## Key Test Structure

### MockMinimalDapClient (L14-53)
Mock implementation of `MinimalDapClient` that extends `EventEmitter`. Provides:
- Connection simulation with `connected` flag
- Request tracking in `requests` array
- Mock responses for `initialize` and `threads` commands
- Simulated event emission for testing event forwarding

### Test Organization
- **JavaScript Policy Tests (L68-220)**: Multi-session support with command routing and breakpoint mirroring
- **Python Policy Tests (L222-248)**: Single-session behavior with minimal routing
- **Default Policy Tests (L250-265)**: Basic fallback behavior
- **Shutdown Tests (L267-291)**: Cleanup verification

## Key Test Scenarios

### Multi-Session Management (L78-97, L143-190)
- Child session creation with event emission validation
- Adoption progress handling to prevent race conditions
- Duplicate adoption request prevention
- Active child tracking and state management

### Command Routing (L99-109, L232-236)
Tests policy-specific routing decisions:
- JavaScript: Routes execution commands (`threads`, `pause`, `continue`) to children
- Python: Routes no commands to children (single-session model)
- Validates commands that stay with parent (`initialize`, `launch`)

### Breakpoint Mirroring (L111-140, L238-247)
- JavaScript policy: Stores and mirrors breakpoints to active children
- Python policy: No breakpoint mirroring
- Tests breakpoint storage in `storedBreakpoints` Map
- Validates automatic mirroring on child session creation

### Event Forwarding (L193-211)
Validates child-to-parent event propagation using `childEvent` emission pattern.

## Dependencies
- `vitest` testing framework with mocks and spies
- `@vscode/debugprotocol` types for DAP structures
- `@debugmcp/shared` adapter policies (`JsDebugAdapterPolicy`, `PythonAdapterPolicy`, `DefaultAdapterPolicy`)
- `ChildSessionManager` from `../../src/proxy/child-session-manager.js`

## Architecture Insights
- Uses policy pattern for adapter-specific behavior differentiation
- Implements event-driven communication between parent and child sessions
- Supports concurrent session management with adoption state tracking
- Provides abstraction layer over raw DAP client connections