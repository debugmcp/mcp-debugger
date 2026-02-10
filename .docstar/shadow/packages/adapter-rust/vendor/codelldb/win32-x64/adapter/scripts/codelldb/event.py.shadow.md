# packages/adapter-rust/vendor/codelldb/win32-x64/adapter/scripts/codelldb/event.py
@source-hash: b773b11640ebf32b
@generated: 2026-02-09T18:10:07Z

**Purpose**: Implements a simple observer pattern event system for synchronous message broadcasting to registered listeners.

**Core Class**:
- `Event` (L4-19): Observer pattern implementation managing listener registration and message broadcasting
  - `__init__` (L5-6): Initializes empty listener list
  - `add(listener)` (L8-10): Registers callable listener accepting Any parameter
  - `remove(listener)` (L12-14): Unregisters specific listener (raises ValueError if not found)
  - `emit(message)` (L16-19): Synchronously notifies all registered listeners with message

**Dependencies**: Uses typing module for type annotations (Callable, Any)

**Architecture**: Simple event dispatcher with list-based listener storage. All operations are synchronous and sequential.

**Critical Behaviors**:
- Listeners must accept exactly one parameter of Any type
- `remove()` will raise ValueError if listener not in list
- Event emission is blocking - each listener executes before next
- No error handling for listener exceptions (will propagate and halt emission)
- Order of listener execution matches registration order