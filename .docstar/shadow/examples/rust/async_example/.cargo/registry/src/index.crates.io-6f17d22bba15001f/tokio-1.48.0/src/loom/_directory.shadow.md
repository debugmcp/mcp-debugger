# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/
@generated: 2026-02-09T18:16:36Z

## Overall Purpose and Responsibility

The `loom/std` directory implements Tokio's **standard library compatibility layer** for the loom deterministic testing framework. This module provides production-ready implementations of synchronization primitives that serve as drop-in replacements when loom testing is disabled, ensuring Tokio can use unified APIs regardless of testing mode.

The directory acts as a critical bridge between Tokio's internal synchronization requirements and the standard library, providing enhanced capabilities like poison recovery, performance optimizations, and platform-adaptive implementations while maintaining API compatibility.

## Key Components and Architecture

### Atomic Infrastructure
- **Enhanced Atomic Types**: `AtomicU16`, `AtomicU32`, `AtomicUsize` with performance-critical `unsync_load()` methods
- **Platform-Adaptive AtomicU64**: Automatically selects native 64-bit atomics or mutex-based fallback based on target architecture
- **Static Initialization**: Conditional compilation for const constructors vs lazy initialization patterns

### Synchronization Ecosystem
- **Poison-Safe Primitives**: `Mutex` and `RwLock` wrappers that automatically recover from poison states
- **High-Performance Options**: Optional parking_lot integration with controlled Send/Sync bounds via PhantomData
- **Extended Functionality**: `Barrier` with timeout support, condition variables, and thread coordination utilities

### System Integration
- **UnsafeCell Wrapper**: Closure-based safe access patterns for raw pointer operations
- **Environment Configuration**: `TOKIO_WORKER_THREADS` override for CPU detection and testing scenarios
- **Feature-Gated Compilation**: Extensive conditional compilation for optimal platform-specific behavior

## Public API Surface

### Core Entry Points
- **Atomic Operations**: Standard atomic methods plus `unsync_load()` for performance-critical paths with caller-guaranteed safety
- **Locking Primitives**: Poison-free `Mutex<T>` and `RwLock<T>` with std::sync-compatible interfaces
- **Thread Coordination**: `Barrier` with timeout, `Condvar`, `thread::yield_now()`
- **System Utilities**: `num_cpus()` with environment override, hash-based `rand::seed()`

### Configuration Interface
- **Feature Flags**: `parking_lot` for high-performance synchronization (miri-aware)
- **Conditional Exports**: AtomicWaker available based on net/process/signal/sync features
- **Environment Variables**: Runtime configuration via `TOKIO_WORKER_THREADS`

## Internal Organization and Data Flow

### Compilation Strategy
The module employs sophisticated conditional compilation:
1. **Platform Detection**: Automatic selection of native vs mutex-based implementations
2. **Feature Resolution**: parking_lot vs std synchronization based on build configuration  
3. **Capability Adaptation**: const constructors vs lazy initialization based on platform support

### Integration Patterns
- **Central Re-export Hub**: `mod.rs` coordinates feature-gated conditional compilation
- **API Consistency**: All primitives maintain std::sync compatibility while adding Tokio-specific enhancements
- **Safety Abstractions**: Poison recovery and unsafe escapes with clear caller contracts

## Important Patterns and Conventions

### Design Principles
- **Zero-Cost Abstraction**: Inlined delegation methods with no runtime overhead
- **Poison Immunity**: All locking operations never panic on poisoned states
- **API Symmetry**: Consistent interface with loom's testing implementations for seamless mode switching
- **Performance Optimization**: Platform-specific atomic selection and optional high-performance synchronization

### Safety and Testing
- **Caller Contracts**: `unsync_load()` requires guaranteed exclusive access or happens-before relationships
- **Deterministic Testing**: Hash-based randomization and environment variable configuration enable reproducible test scenarios
- **Build Consistency**: Feature flags must be uniform across entire Tokio compilation

This directory is essential for Tokio's dual-mode operation, providing production-grade synchronization primitives that maintain perfect API compatibility with loom's testing implementations while delivering optimal runtime performance.