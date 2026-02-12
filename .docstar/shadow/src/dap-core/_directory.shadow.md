# src\dap-core/
@generated: 2026-02-12T21:00:57Z

## Overall Purpose

The `dap-core` directory provides the foundational functional programming layer for Debug Adapter Protocol (DAP) operations. This package implements pure, stateless message handling and state management for debugging sessions, serving as the core business logic that bridges between the DAP protocol specification and external I/O operations.

## Architecture & Component Relationships

The module follows a clean functional architecture with three tightly integrated components:

**Core Data Layer** (`types.ts`):
- Defines all TypeScript interfaces for DAP session state, proxy messages, and command structures
- Establishes the contract for pure functional operations through immutable types
- Uses discriminated unions for type-safe message handling and effect representation

**Pure State Management** (`state.ts`):
- Implements immutable state transformations for DAP session lifecycle
- Provides functions for session initialization, thread management, and request tracking
- All operations return new state objects, never mutating inputs

**Message Processing Engine** (`handlers.ts`):
- Contains the core business logic for processing proxy messages and DAP protocol events
- Implements a functional dispatch system that transforms messages into commands and state changes
- Handles the complete DAP session lifecycle from initialization through termination

## Public API Surface

**Main Entry Point**: 
- `index.ts` - Barrel export providing unified access to all functionality

**Key Functions**:
- `handleProxyMessage()` - Primary message dispatcher and validator
- `createInitialState()` - Session state initialization
- State management functions: `setInitialized()`, `setAdapterConfigured()`, `addPendingRequest()`, etc.

**Core Types**:
- `DAPSessionState` - Immutable session state container
- `ProxyMessage` - Union of all proxy communication types  
- `DAPCommand` - Effect representation for external operations
- `DAPProcessingResult` - Handler return type with commands and new state

## Internal Organization & Data Flow

The module processes DAP communications through a pure functional pipeline:

1. **Message Reception**: `handleProxyMessage()` validates and routes incoming proxy messages
2. **Type-Specific Processing**: Dedicated handlers process status updates, errors, DAP events, and responses
3. **State Transformation**: Handlers use pure state functions to create updated session state
4. **Effect Generation**: Handlers emit `DAPCommand` arrays for logging, event emission, and external operations
5. **Result Return**: Processing functions return both effects to execute and new state to persist

## Key Patterns & Conventions

**Functional Purity**: All core functions are pure - no side effects, predictable outputs for given inputs. Side effects are represented as data structures (`DAPCommand`) for external execution.

**Immutable State**: Session state is never mutated directly. All updates create new state objects using spread operators and defensive copying.

**Effect-as-Data**: External operations (logging, process control, client communication) are represented as command objects rather than executed directly, enabling testability and separation of concerns.

**Phase-Based Implementation**: The handlers implement a three-phase approach - Phase 1 (status/error handling) is complete, Phase 2 (DAP events) has basic implementation, Phase 3 (DAP responses) is placeholder for future expansion.

This architecture enables reliable, testable DAP session management with clear separation between business logic and I/O operations, making it suitable for integration into larger debugging infrastructures.