# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/tests/loom_oneshot.rs
@source-hash: cb0cb66e1014708a
@generated: 2026-02-09T18:03:12Z

**Purpose**: Loom-compatible oneshot channel implementation for Tokio's test suite. Provides a single-use, thread-safe communication primitive specifically designed for testing concurrent scenarios under Loom's model checker.

**Key Components**:
- `channel<T>()` (L4-16): Factory function that creates a sender/receiver pair sharing the same `Inner<T>` instance via `Arc`
- `Sender<T>` (L18-20): Send-side handle containing shared `Arc<Inner<T>>`
- `Receiver<T>` (L22-24): Receive-side handle containing shared `Arc<Inner<T>>`
- `Inner<T>` (L26-29): Core synchronization state with `Notify` for signaling and `Mutex<Option<T>>` for value storage

**Critical Methods**:
- `Sender::send(self, value: T)` (L32-35): Consumes sender, stores value in mutex, notifies receiver. Single-use by design (takes `self`)
- `Receiver::recv(self) -> T` (L39-47): Consumes receiver, polls for value in loop, blocks on `notify.wait()` until value available

**Synchronization Architecture**:
- Uses Loom's `Notify` primitive for efficient blocking/wakeup semantics
- `Mutex<Option<T>>` provides atomic value transfer - `None` indicates no value sent yet
- Receiver polling loop checks for value, then waits on notification if empty
- Single-producer, single-consumer design enforced by consuming `self`

**Dependencies**:
- `crate::loom::sync::{Arc, Mutex}`: Loom-instrumented sync primitives for model checking
- `loom::sync::Notify`: Loom's condition variable equivalent for async coordination

**Testing Context**: This is a test-specific channel implementation that works under Loom's deterministic execution model, allowing verification of concurrent behavior in Tokio's runtime tests.