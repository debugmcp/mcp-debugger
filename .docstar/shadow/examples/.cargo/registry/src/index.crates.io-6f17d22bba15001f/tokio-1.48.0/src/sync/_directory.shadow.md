# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/
@generated: 2026-02-09T18:16:19Z

## Overall Purpose
The `tokio::sync` module provides a comprehensive suite of asynchronous synchronization primitives and message-passing channels for coordinating tasks in Tokio's async runtime. This module serves as the primary synchronization API, offering both traditional synchronization primitives (mutexes, semaphores, barriers) and async-specific communication channels (oneshot, mpsc, broadcast, watch) that can all be safely held across `.await` points.

## Key Architecture Patterns

### Async-First Design
All primitives are designed to work efficiently in async contexts without blocking the runtime thread. They integrate with Tokio's cooperative task scheduling system and support cancellation-safe operations where appropriate.

### Fair Synchronization
Most primitives use FIFO ordering to prevent starvation - tasks acquire locks, permits, and notifications in the order they requested them. This ensures predictable performance under contention.

### Two-Tier Implementation Strategy
The module uses a two-tier architecture where high-level user-facing types wrap lower-level implementations (e.g., `Semaphore` wraps `batch_semaphore::Semaphore`, `Mutex` wraps a semaphore with capacity 1).

## Core Component Categories

### Message-Passing Channels
- **oneshot**: Single-value, single-use channel for one-time communication between tasks
- **mpsc**: Multi-producer, single-consumer streaming channel for task communication
- **broadcast**: Multi-producer, multi-consumer channel where all subscribers receive all messages
- **watch**: Multi-producer, multi-consumer channel that only retains the latest value

### State Synchronization Primitives
- **Mutex**: Exclusive access lock with multiple guard variants (borrowed, owned, mapped)
- **RwLock**: Reader-writer lock allowing multiple concurrent readers or exclusive writer access
- **Semaphore**: Counting semaphore for resource access control with permit-based coordination
- **Barrier**: Synchronization point where multiple tasks wait for each other before proceeding

### Notification Primitives
- **Notify**: Single-permit notification system supporting both FIFO and LIFO wake strategies
- **OnceCell**: Thread-safe lazy initialization with async support
- **SetOnce**: Single-assignment cell with async wait capabilities

## Public API Entry Points

### Channel Creation Functions
- `oneshot::channel<T>()` → `(Sender<T>, Receiver<T>)`
- `mpsc::channel<T>(buffer)` → `(Sender<T>, Receiver<T>)`
- `broadcast::channel<T>(capacity)` → `(Sender<T>, Receiver<T>)`
- `watch::channel<T>(init)` → `(Sender<T>, Receiver<T>)`

### Synchronization Constructors
- `Mutex::new(value)`, `RwLock::new(value)` for data protection
- `Semaphore::new(permits)` for resource limiting
- `Barrier::new(n)` for task coordination
- `Notify::new()` for event signaling
- `OnceCell::new()`, `SetOnce::new()` for initialization patterns

## Internal Organization

### Core Implementation Modules
- `batch_semaphore.rs`: Low-level semaphore with fair batched permit distribution
- Individual primitive modules: `mutex.rs`, `rwlock/`, `notify.rs`, etc.
- Guard type modules: Separate modules for various guard implementations

### Shared Infrastructure
- **AtomicWaker**: Internal task waking mechanism used across primitives
- **WakeList**: Batch waker notification for efficient multi-task coordination
- **Intrusive linked lists**: Used for fair queuing in waitlists
- **Tracing integration**: Optional tokio-console instrumentation throughout

## Data Flow Patterns

### Channel Flow
1. Producers send data through channel-specific `send()` methods
2. Data is buffered or broadcast according to channel semantics
3. Consumers receive via `recv()`, `try_recv()`, or async iteration
4. Channels handle backpressure, lagging, and closure scenarios

### Lock Flow  
1. Tasks acquire guards via `lock()`, `read()`, `write()` methods
2. Guards provide `Deref`/`DerefMut` access to protected data
3. Guards automatically release locks on drop
4. Multiple guard variants support different ownership patterns (borrowed, owned, mapped)

### Notification Flow
1. Waiters register interest via notification primitives
2. Notifiers trigger wake events through `notify_*()` methods  
3. Fair queuing ensures waiters are served in FIFO order
4. Bulk notifications optimize multi-waiter scenarios

## Feature-Gated Organization
The module uses extensive conditional compilation (`cfg_sync!`) to include full sync API when the "sync" feature is enabled, with fallback minimal implementations for internal use by other Tokio components. This allows fine-grained feature control while maintaining necessary internal synchronization capabilities.

## Integration Points
All primitives integrate with Tokio's task system for proper async/await behavior, cooperative scheduling, and runtime-agnostic operation. They work across different async runtimes while providing optimal performance within the Tokio ecosystem.