# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/
@generated: 2026-02-09T18:16:04Z

## Overall Purpose
The `loom` directory provides a conditional abstraction layer for synchronization primitives that enables deterministic testing of Tokio's concurrent code. It acts as a compile-time switch between standard library sync primitives (for production) and Loom's mocked testing framework (for concurrency verification).

## Key Components and Architecture

### Conditional Module System
- **mod.rs**: Central dispatcher using conditional compilation (`#[cfg(all(test, loom))]`) to select between implementations
- **std module**: Standard library synchronization primitives for production builds
- **mocked.rs**: Loom-wrapped testing implementations for deterministic concurrency testing

### Sync Primitive Abstractions
The mocked implementation provides unified interfaces for:
- **Mutex<T>**: Thread-safe mutual exclusion with simplified error handling (panics on poison)
- **RwLock<T>**: Reader-writer locks supporting concurrent reads and exclusive writes
- **Atomic types**: Atomic operations with fallback support for missing loom implementations
- **Guard types**: Lock ownership tracking through re-exported loom guards

### System Utilities
Testing environment provides mocked system calls:
- **rand::seed()**: Fixed deterministic seed value (1) for reproducible tests
- **sys::num_cpus()**: Fixed CPU count (2) for consistent test conditions
- **thread module**: Thread primitives and synchronization support

## Public API Surface
All APIs are crate-internal (`pub(crate)`) and mirror standard library interfaces:
- Mutex/RwLock construction, locking, and try-locking operations
- Atomic operations compatible with std::sync::atomic
- System query functions with deterministic test behavior
- Thread management and synchronization primitives

## Internal Organization and Data Flow
1. **Compile-time selection**: Build configuration determines active module (std vs mocked)
2. **Wrapper pattern**: Mocked implementations wrap loom types with simplified error handling
3. **Interface compatibility**: Both implementations expose identical APIs to consuming code
4. **Re-export strategy**: Unified module interface through `pub(crate) use` declarations

## Important Patterns
- **Conditional compilation**: Ensures only one implementation active per build
- **Panic-on-poison**: Testing assumes non-poisoned locks for simplified error paths
- **Deterministic mocking**: Fixed values for system queries enable reproducible test outcomes
- **Transparent abstraction**: Consuming code remains unaware of which implementation is active

This directory enables Tokio to run the same concurrent code in both production (with real sync primitives) and testing environments (with Loom's deterministic scheduling), providing confidence in the correctness of async/concurrent algorithms.