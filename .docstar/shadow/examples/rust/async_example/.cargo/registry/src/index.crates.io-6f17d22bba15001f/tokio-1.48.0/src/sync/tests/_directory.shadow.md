# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/tests/
@generated: 2026-02-09T18:16:20Z

## Purpose and Responsibility

Comprehensive test suite for Tokio's synchronization primitives located in `src/sync/`. This directory contains both traditional unit tests and advanced concurrency testing using the Loom model checker to verify thread safety and detect race conditions across all major sync components.

## Key Components and Organization

### Test Module Structure
- **`mod.rs`**: Central module coordinator using conditional compilation (`cfg_not_loom!`/`cfg_loom!`) to switch between regular tests and Loom-based concurrency testing
- **Traditional Tests**: Standard unit tests for `atomic_waker`, `notify`, and `semaphore_batch`
- **Loom Tests**: Model checking variants (`loom_*` modules) for exhaustive concurrency verification

### Core Synchronization Primitives Tested

**Notification and Waking**:
- `atomic_waker.rs`: Tests AtomicWaker thread-safe waker registration and notification
- `notify.rs`: Tests Notify primitive for task coordination and waker management
- `loom_atomic_waker.rs` / `loom_notify.rs`: Loom variants testing all possible thread interleavings

**Channels and Communication**:
- `loom_broadcast.rs`: Multi-consumer broadcast channel with overflow/lag handling
- `loom_mpsc.rs`: Multi-producer single-consumer channels (bounded/unbounded)
- `loom_oneshot.rs`: Single-use channels with proper closure semantics
- `loom_watch.rs`: Single-producer multi-consumer state watching with predicate-based waiting

**Synchronization Utilities**:
- `semaphore_batch.rs`: Batch semaphore supporting multi-permit acquisition patterns
- `loom_semaphore_batch.rs`: Concurrency testing for batch semaphore operations
- `loom_rwlock.rs`: Reader-writer lock with async support and guard downgrading
- `loom_set_once.rs`: Write-once synchronization primitive with proper cleanup

**Internal Components**:
- `loom_list.rs`: Lock-free MPSC list implementation used by channels

## Public API Surface

### Test Entry Points
- **Regular Testing**: Import individual test modules based on `cfg_not_loom!` configuration
- **Loom Testing**: Model checking tests activated with `cfg_loom!` for deterministic concurrency verification
- **Platform Compatibility**: WASM-specific conditional compilation and panic handling adaptations

### Testing Patterns and Utilities
- **Custom Test Harnesses**: DropCounter, PanickingWaker, and other utilities for edge case testing
- **Concurrency Validation**: Loom model checking for exhaustive thread interleaving exploration
- **State Verification**: Extensive use of `tokio_test` assertion macros for async state validation

## Internal Organization and Data Flow

### Dual Testing Strategy
1. **Traditional Tests**: Fast, focused unit tests for basic functionality and edge cases
2. **Model Checking**: Exhaustive concurrency testing using Loom's deterministic execution

### Critical Invariants Tested
- **Memory Safety**: All synchronization primitives must be Send/Sync safe
- **Notification Correctness**: Wake operations must not lose or duplicate notifications
- **Channel Semantics**: Proper message ordering, closure handling, and overflow behavior
- **Permit Management**: Accurate tracking and release of semaphore permits
- **Panic Safety**: System remains functional after panicking operations

### Cross-Component Integration
Tests validate interaction between primitives (e.g., `watch_test` in `notify.rs` demonstrates cross-component usage) and ensure consistent behavior across the entire sync module ecosystem.

## Important Patterns and Conventions

### Loom Integration
- All concurrency tests wrapped in `loom::model()` for systematic exploration
- Deterministic thread spawning and async execution via loom primitives
- Custom preemption bounds for complex scenarios requiring specific scheduling

### Memory and Resource Management
- Arc-based sharing patterns for multi-threaded scenarios
- Custom Drop implementations for resource leak detection
- Proper cleanup verification when futures are cancelled or dropped

### Platform Adaptations
- WASM-specific test exclusions for unsupported threading features
- Panic unwind testing disabled on platforms without unwinding support
- Thread-local storage for execution context tracking in complex scenarios

This test suite ensures Tokio's synchronization primitives maintain correctness, performance, and safety guarantees across all supported platforms and concurrent usage patterns.