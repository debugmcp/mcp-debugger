# src/dap-core/
@generated: 2026-02-11T23:47:37Z

## Overall Purpose

The `src/dap-core` directory provides a functional, stateless Debug Adapter Protocol (DAP) processing engine. It implements pure functional message handling for debugging sessions, emphasizing immutability, testability, and explicit side effect management.

## Core Architecture

The module follows a clean functional architecture with three main layers:

**Type System (`types.ts`)**
- Defines immutable data structures for DAP session state (`DAPSessionState`)
- Specifies proxy communication protocol (`ProxyMessage` unions)
- Models side effects as data (`DAPCommand`)
- Provides processing contracts (`DAPProcessingResult`)

**State Management (`state.ts`)** 
- Pure functional state operations with immutability guarantees
- Session lifecycle tracking (initialization, adapter configuration)
- Thread management and pending request handling
- Defensive copying for complex data structures (Maps)

**Message Handlers (`handlers.ts`)**
- Stateless message processors that transform input to commands + new state
- Three-phase processing architecture:
  - Phase 1: Status/error handling (complete)
  - Phase 2: DAP event handling (basic implementation) 
  - Phase 3: DAP response handling (placeholder)
- Type-safe message routing and validation

## Public API Surface

The main entry point is through `index.ts` which provides:

### Core Functions
- `handleProxyMessage()` - Primary message dispatcher and validator
- `createInitialState()` - Session state initialization
- State management functions: `setInitialized()`, `setAdapterConfigured()`, `setCurrentThreadId()`
- Request lifecycle: `addPendingRequest()`, `removePendingRequest()`, `getPendingRequest()`

### Key Types
- `DAPSessionState` - Immutable session state container
- `ProxyMessage` - Union of all proxy communication types
- `DAPCommand` - Side effect representation
- `DAPProcessingResult` - Handler return contract

## Data Flow Pattern

1. **Message Reception**: Proxy messages enter via `handleProxyMessage()`
2. **Validation & Routing**: Session ID validation, type-based message dispatch
3. **Pure Processing**: Type-specific handlers process messages without side effects
4. **Result Generation**: Handlers return `DAPProcessingResult` with:
   - `DAPCommand[]` representing side effects (logging, events, process control)
   - Optional new `DAPSessionState`
5. **Effect Execution**: Consuming code executes commands and applies state changes

## Key Design Patterns

**Functional Purity**: All core functions are pure with no side effects - they accept inputs and return deterministic outputs

**Effect as Data**: Side effects like logging, event emission, and process control are represented as data structures (`DAPCommand`) rather than performed directly

**Immutable State**: All state updates create new state objects, enabling safe concurrent access and easy testing

**Type Safety**: Comprehensive TypeScript interfaces ensure message handling correctness

This architecture enables reliable, testable DAP session management with clear separation between business logic and I/O operations.