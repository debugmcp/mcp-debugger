# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/watch.rs
@source-hash: 3ba877b19b87b0d1
@generated: 2026-02-09T18:06:55Z

## Multi-producer, multi-consumer watch channel

This module implements a watch channel that only retains the last sent value, optimized for broadcasting configuration changes or state updates to multiple consumers.

### Core Components

**Channel Creation**
- `channel<T>(init: T) -> (Sender<T>, Receiver<T>)` (L554-574): Creates a new watch channel with an initial value

**Sender<T> (L197-199)**
- Multi-producer handle for sending values
- `send(value)` (L1064-1072): Sends value, fails if no receivers
- `send_modify(modify)` (L1104-1112): Modifies value in-place unconditionally
- `send_if_modified(modify)` (L1171-1211): Conditionally modifies and notifies only if changed
- `send_replace(value)` (L1229-1234): Replaces value and returns previous
- `borrow()` (L1253-1260): Returns reference to current value
- `subscribe()` (L1387-1394): Creates new receiver with current value marked as seen
- `is_closed()` (L1274-1276): Checks if all receivers dropped
- `closed()` (L1313-1330): Async wait for all receivers to drop
- Reference counting: `ref_count_tx` tracks sender instances

**Receiver<T> (L185-191)**
- Multi-consumer handle for receiving values
- `version: Version`: Tracks last observed value version
- `borrow()` (L629-638): Returns reference without marking as seen
- `borrow_and_update()` (L676-688): Returns reference and marks as seen
- `has_changed()` (L738-748): Synchronously checks for unseen changes
- `changed()` (L818-820): Async wait for unseen value
- `wait_for(f)` (L889-894): Waits for value matching predicate
- `mark_changed()` (L758-760): Forces change state
- `mark_unchanged()` (L768-771): Marks current value as seen

**Shared<T> State (L296-317)**
- `value: RwLock<T>`: The actual watched value with read/write access
- `state: AtomicState`: Version counter with closed bit (LSB indicates closed)
- `ref_count_rx/tx: AtomicUsize`: Reference counters for lifetime management
- `notify_rx: BigNotify`: Notifies receivers of value changes
- `notify_tx: Notify`: Notifies senders when all receivers dropped

**Ref<'a, T> (L243-246)**
- RAII guard for borrowed values with read lock
- `has_changed: bool`: Whether this reference represents an unseen value
- `has_changed()` (L291-293): Returns change status

### Key Mechanisms

**Version Tracking**: Each value update increments version counter (L503-509), receivers compare their stored version to detect changes

**BigNotify Optimization (L387-425)**: Uses 8 `Notify` instances to reduce contention, with randomized or round-robin selection

**State Management**: Atomic state encoding with closed bit in LSB and version in remaining bits (L433-515)

**Cooperative Scheduling**: Uses `cooperative()` wrapper for async operations to prevent starvation

### Memory Ordering
- Senders use `Release` ordering when updating state (L508)  
- Receivers use `Acquire` ordering when loading state (L499)
- Ensures proper handover of shared values

### Error Types
- `SendError<T>` (L339): Channel closed, contains unsent value
- `RecvError` (L359): Channel closed and current value already seen

### Behavioral Differences
- `has_changed()` errors only if channel closed
- `changed()` errors if channel closed AND current value seen
- `borrow()` vs `borrow_and_update()`: latter marks value as seen, preventing spurious loop iterations

This implementation provides efficient last-value caching with proper synchronization for high-frequency configuration updates or state broadcasting scenarios.