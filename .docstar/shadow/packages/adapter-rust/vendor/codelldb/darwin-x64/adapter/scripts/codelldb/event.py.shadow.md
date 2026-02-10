# packages/adapter-rust/vendor/codelldb/darwin-x64/adapter/scripts/codelldb/event.py
@source-hash: b773b11640ebf32b
@generated: 2026-02-09T18:07:23Z

**Primary Purpose**: Simple event publisher implementation providing observer pattern functionality for CodeLLDB debugger adapter.

**Architecture**: Classic observer pattern with synchronous notification. No error handling or thread safety mechanisms.

**Key Components**:
- `Event` class (L4-19): Core event publisher
  - `__init__` (L5-6): Initializes empty listener list
  - `add` (L8-10): Registers event listener callback
  - `remove` (L12-14): Unregisters specific listener (raises ValueError if not found)
  - `emit` (L16-19): Synchronously notifies all registered listeners with message

**Type Contracts**:
- Listeners must accept `Any` type parameter and return `None`
- Messages can be any type (`Any`)

**Critical Behaviors**:
- No duplicate prevention - same listener can be added multiple times
- `remove()` will raise `ValueError` if listener not found
- Listeners called in registration order
- No exception isolation - listener exceptions propagate and halt notification chain

**Usage Pattern**: Typical publish-subscribe for debugger events (breakpoints, execution state changes, etc.)