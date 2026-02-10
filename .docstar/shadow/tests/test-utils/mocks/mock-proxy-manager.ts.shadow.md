# tests/test-utils/mocks/mock-proxy-manager.ts
@source-hash: 791970fddf17cc15
@generated: 2026-02-10T00:41:32Z

## Purpose
Mock implementation of ProxyManager for comprehensive unit testing of debug adapter proxy functionality. Provides controllable simulation of debug adapter protocol operations, event emission, and error conditions.

## Architecture
**MockProxyManager (L11)** extends EventEmitter and implements IProxyManager interface. Uses private state tracking and public test controls to simulate real proxy behavior while enabling deterministic testing scenarios.

## Core State Management
- **Private state (L12-18)**: Tracks running status, thread ID, config, DAP handler, and dry-run completion
- **Call tracking (L21-23)**: Records all method invocations for test verification
- **Behavior controls (L25-29)**: Flags to simulate failures and delays for error testing

## Key Methods

### Lifecycle Management
- **start() (L35-70)**: Simulates proxy startup with configurable delays/failures. Emits initialization events based on config (dry-run vs normal mode)
- **stop() (L72-84)**: Resets state and emits exit event asynchronously
- **reset() (L236-252)**: Complete state reset for test isolation

### Debug Protocol Simulation
- **sendDapRequest() (L86-180)**: Core DAP command simulation with:
  - Call tracking and validation (L90-94)
  - Configurable failure modes (L96-98)  
  - Custom handler support (L104-108)
  - Default mock responses for common commands (L110-179)

### Test Utilities
- **setDapRequestHandler() (L191-193)**: Allows custom DAP response logic
- **simulateEvent() (L195-205)**: Manual event emission for testing edge cases
- **simulateStopped/Error/Exit() (L207-220)**: Specific event simulation methods
- **hasDryRunCompleted/getDryRunSnapshot() (L222-234)**: Dry-run state inspection

## Event Simulation Patterns
Uses `process.nextTick()` for asynchronous event emission (L53, L81, L166, L172) to simulate real-world timing while remaining deterministic for tests.

## Default DAP Responses
Provides realistic mock responses for:
- **setBreakpoints**: Returns verified breakpoints (L112-121)
- **stackTrace**: Single frame mock stack (L123-135)
- **scopes/variables**: Basic variable inspection (L137-160)
- **Step commands**: Automatic stopped event emission (L162-169)
- **continue**: Continued event emission (L171-175)

## Dependencies
- EventEmitter for event-driven architecture
- @vscode/debugprotocol for DAP type definitions
- Local proxy-manager interface for contract compliance