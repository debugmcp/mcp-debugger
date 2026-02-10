# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/std/
@generated: 2026-02-09T18:16:15Z

## Overall Purpose and Responsibility

This directory implements Tokio's **standard library compatibility layer** for the loom testing framework. When loom testing is disabled, this module provides drop-in replacements for standard library synchronization primitives with enhanced capabilities and consistent APIs that match Tokio's internal requirements.

The module serves as a compatibility shim that allows Tokio's codebase to use unified synchronization APIs regardless of whether loom deterministic testing is active or standard runtime behavior is needed.

## Key Components and Architecture

### Atomic Primitives (`atomic_*.rs`)
- **AtomicU16, AtomicU32, AtomicUsize**: Enhanced wrappers around std atomics adding unsafe `unsync_load()` methods for performance-critical paths
- **AtomicU64**: Platform-adaptive implementation that automatically selects between native 64-bit atomics or mutex-based fallback based on target architecture support
- **Static Initialization**: Conditional compilation chooses between const constructors or lazy initialization patterns depending on platform capabilities

### Synchronization Primitives
- **Mutex**: Non-poisoning wrapper around `std::sync::Mutex` that automatically recovers from poison errors
- **RwLock**: Poison-immune wrapper around `std::sync::RwLock` with automatic poison recovery
- **Parking Lot Integration**: Optional high-performance synchronization via parking_lot crate with PhantomData wrappers to control Send/Sync bounds
- **Barrier**: Enhanced barrier implementation extending std::sync::Barrier with timeout functionality
- **Condvar**: Condition variable support (via parking_lot or std)

### Core Infrastructure
- **UnsafeCell**: Thin wrapper providing closure-based safe access patterns to raw pointers
- **Module Organization**: `mod.rs` serves as the central re-export hub with feature-gate driven conditional compilation

## Public API Surface

### Primary Entry Points
- **Atomic Types**: `AtomicU16`, `AtomicU32`, `AtomicU64`, `AtomicUsize` with standard atomic operations plus `unsync_load()`
- **Locking Primitives**: `Mutex<T>`, `RwLock<T>` with poison-free locking methods
- **Synchronization**: `Barrier` with timeout support, `Condvar` for thread coordination
- **System Utilities**: `num_cpus()` with environment variable override, `thread::yield_now()`
- **Random Generation**: Hash-based `rand::seed()` for deterministic testing

### Feature-Based Configuration
- **parking_lot**: Opt-in high-performance synchronization (disabled under miri)
- **net/process/signal/sync**: Conditional AtomicWaker export for async coordination
- **TOKIO_WORKER_THREADS**: Environment variable override for CPU count detection

## Internal Organization and Data Flow

### Compilation Strategy
The module uses extensive conditional compilation (`cfg` attributes) to select appropriate implementations:
1. **Platform Detection**: Automatically chooses native vs mutex-based atomics based on target architecture
2. **Feature Gates**: Selects parking_lot vs std synchronization based on feature flags
3. **Static vs Dynamic**: Chooses const constructors vs lazy initialization based on platform capabilities

### Safety Patterns
- **Poison Recovery**: All mutex/rwlock operations automatically recover from poisoned states
- **Unsafe Escapes**: Atomic types provide `unsync_load()` for performance with caller-guaranteed safety invariants
- **PhantomData Wrappers**: Control Send/Sync bounds independently of underlying implementations

## Important Patterns and Conventions

### API Consistency
- All synchronization primitives maintain std::sync-compatible interfaces while adding Tokio-specific enhancements
- `pub(crate)` visibility ensures internal-only usage within Tokio
- Const constructors available where platform supports them

### Performance Optimizations
- Inlined delegation methods for zero-cost abstraction
- Platform-specific atomic selection for optimal performance
- Optional parking_lot integration for reduced contention

### Testing Integration  
- Designed as counterpart to loom's testing implementations
- Consistent API surface allows seamless switching between test and production modes
- Environment variable configuration enables testing different threading scenarios

## Critical Invariants

- All locking operations are poison-safe and never panic on poisoned locks
- Atomic `unsync_load()` requires caller-guaranteed exclusive access or happens-before relationships
- Platform-specific implementations maintain identical public APIs
- Feature flag selection must be consistent across the entire Tokio build