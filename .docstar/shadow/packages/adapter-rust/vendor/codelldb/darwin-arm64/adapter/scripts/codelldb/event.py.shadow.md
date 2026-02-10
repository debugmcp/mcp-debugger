# packages/adapter-rust/vendor/codelldb/darwin-arm64/adapter/scripts/codelldb/event.py
@source-hash: b773b11640ebf32b
@generated: 2026-02-09T18:06:50Z

## Purpose
Simple observer pattern implementation for event handling in the CodeLLDB debugger adapter. Provides a lightweight pub/sub mechanism for notifying multiple listeners of events.

## Key Components

### Event Class (L4-19)
Core event dispatcher that maintains a list of callback functions and notifies them when events occur.

**Key Methods:**
- `__init__()` (L5-6): Initializes empty listener list `_listeners`
- `add(listener)` (L8-10): Registers a new event listener callback
- `remove(listener)` (L12-14): Unregisters an existing listener callback  
- `emit(message)` (L16-19): Broadcasts message to all registered listeners synchronously

## Architecture Patterns
- **Observer Pattern**: Classic implementation allowing multiple observers to subscribe to events
- **Type Safety**: Uses typing annotations with `Callable[[Any], None]` for listener signature
- **Synchronous Notification**: All listeners called sequentially in registration order

## Dependencies
- `typing`: For type annotations (`Callable`, `Any`)

## Critical Behavior
- Listeners receive arbitrary message payloads (typed as `Any`)
- `remove()` will raise `ValueError` if listener not found in list
- Event emission is synchronous - if any listener blocks/fails, it affects subsequent listeners
- No error handling around listener invocation - exceptions will propagate