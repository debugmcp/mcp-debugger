# src/dap-core/
@generated: 2026-02-09T18:16:12Z

## Overall Purpose

The `src/dap-core` module provides a functional, stateless implementation of Debug Adapter Protocol (DAP) message handling and session state management. It serves as the core processing engine for DAP proxy communications, implementing pure functional patterns with immutable state transformations and command-based side effect management.

## Key Components and Relationships

### Type System Foundation (`types.ts`)
- Defines comprehensive type definitions for all DAP session structures, proxy messages, and command patterns
- Establishes discriminated unions for type-safe message handling
- Provides immutable data structures using `readonly` modifiers throughout
- Creates command pattern abstractions that separate action description from execution

### State Management (`state.ts`)
- Implements pure functional state operations for DAP session lifecycle
- Provides factory functions for initial state creation and immutable update operations
- Manages pending request tracking with defensive Map cloning
- Enforces architectural invariants through TypeScript utility types (Partial, Omit)

### Message Processing (`handlers.ts`)
- Contains specialized pure functions for each proxy message type
- Main dispatcher (`handleProxyMessage`) routes messages to appropriate handlers
- Transforms proxy communications into command arrays and state updates
- Implements stateless processing with no side effects or external dependencies

### Public API (`index.ts`)
- Barrel export pattern providing unified access to all core functionality
- Single import point for types, state management, and handlers
- Facade pattern hiding internal module organization

## Public API Surface

### Main Entry Points
- **Types**: All DAP protocol types, state structures, and message definitions
- **State Management**: `createInitialState`, state update functions, pending request management
- **Message Processing**: `handleProxyMessage` (primary dispatcher), specialized handlers for status, error, DAP events, and responses
- **Command System**: `DAPCommand` union for describing side effects, `DAPProcessingResult` for processing outcomes

### Integration Pattern
External systems integrate by:
1. Creating initial session state via `createInitialState`
2. Processing proxy messages through `handleProxyMessage`
3. Executing returned commands (logging, events, proxy communication)
4. Updating session state with returned state changes

## Internal Organization and Data Flow

### Processing Pipeline
1. **Message Validation**: Type guards verify proxy message structure
2. **Session Routing**: Messages dispatched by sessionId and type
3. **Specialized Handling**: Type-specific handlers process messages and update state
4. **Command Generation**: Handlers emit commands for external execution
5. **State Updates**: New state objects returned for immutable updates

### State Flow
- Session state flows unidirectionally through pure functions
- State updates always return new objects, never mutate inputs
- Pending requests managed through defensive Map cloning
- Thread tracking and adapter lifecycle maintained immutably

### Command Pattern
- Core never executes side effects directly
- All external actions described as `DAPCommand` objects
- External systems responsible for command execution (logging, IPC, events)
- Clear separation between processing logic and side effect execution

## Important Patterns and Conventions

### Functional Programming Principles
- Pure functions with no side effects
- Immutable state management throughout
- Command pattern for side effect management
- Discriminated unions for type-safe message handling

### Development Phases
- **Phase 1**: Status and error handling (complete)
- **Phase 2**: DAP event handling (implemented)
- **Phase 3**: DAP response handling (placeholder implementation)

### Architectural Constraints
- No direct external dependencies beyond standard DAP protocol types
- State mutations only through provided helper functions
- All handlers return structured results with commands and optional state updates
- Type safety enforced through comprehensive TypeScript definitions

This module serves as the foundational layer for DAP proxy communication, providing a clean functional interface for message processing while maintaining complete separation from side effects and external system integration.