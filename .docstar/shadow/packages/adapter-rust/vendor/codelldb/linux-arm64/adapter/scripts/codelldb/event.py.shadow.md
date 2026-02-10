# packages/adapter-rust/vendor/codelldb/linux-arm64/adapter/scripts/codelldb/event.py
@source-hash: b773b11640ebf32b
@generated: 2026-02-09T18:09:16Z

## Purpose
Simple event system implementation providing observer pattern functionality for the CodeLLDB debugger adapter. Enables decoupled communication between components through event emission and listener registration.

## Key Components

### Event Class (L4-19)
Core event dispatcher that manages listener registration and event broadcasting.

**Constructor** (L5-6):
- Initializes empty listener list `_listeners`

**Key Methods**:
- `add(listener)` (L8-10): Registers event listener callable that accepts Any parameter
- `remove(listener)` (L12-14): Unregisters specific listener from event notifications  
- `emit(message)` (L16-19): Broadcasts message to all registered listeners sequentially

## Dependencies
- `typing`: Uses `Callable` and `Any` type hints for listener function signatures

## Architecture Patterns
- **Observer Pattern**: Classic implementation allowing multiple observers to react to events
- **Type-safe Design**: Leverages type hints for listener callable signatures
- **Synchronous Execution**: Listeners called sequentially in registration order during emit

## Critical Behaviors
- No error handling for listener exceptions - failed listener will halt subsequent notifications
- `remove()` will raise ValueError if listener not found in list
- Listener order depends on registration sequence