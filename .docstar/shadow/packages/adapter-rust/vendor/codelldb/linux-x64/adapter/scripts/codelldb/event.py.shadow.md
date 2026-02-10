# packages/adapter-rust/vendor/codelldb/linux-x64/adapter/scripts/codelldb/event.py
@source-hash: b773b11640ebf32b
@generated: 2026-02-09T18:10:16Z

**Primary Purpose**: Implements a simple event system allowing objects to subscribe to and receive notifications when events are emitted.

**Core Components**:
- `Event` class (L4-19): Observer pattern implementation managing event listeners and notifications
  - `__init__` (L5-6): Initializes empty listeners list
  - `add` (L8-10): Registers callable listeners that accept any type of message
  - `remove` (L12-14): Unregisters specific listener from event notifications  
  - `emit` (L16-19): Broadcasts message to all registered listeners synchronously

**Dependencies**: 
- `typing.Callable` and `typing.Any` for type annotations

**Architectural Pattern**: Classic Observer pattern with synchronous notification delivery. Listeners are called in registration order during emission.

**Key Characteristics**:
- Thread-unsafe: no synchronization mechanisms for concurrent access
- Error propagation: listener exceptions will halt notification chain
- Memory management: listeners must be manually removed to prevent memory leaks
- Type flexibility: accepts any callable and any message type