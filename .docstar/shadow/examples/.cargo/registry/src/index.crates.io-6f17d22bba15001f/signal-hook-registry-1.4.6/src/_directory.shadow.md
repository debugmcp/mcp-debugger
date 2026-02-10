# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/signal-hook-registry-1.4.6/src/
@generated: 2026-02-09T18:16:12Z

## Purpose
This module implements a low-level, async-signal-safe signal multiplexing registry for Unix and Windows systems. It enables multiple callbacks to be registered for the same signal while maintaining compatibility across different versions of higher-level signal-handling crates. The core design prioritizes signal handler safety by avoiding memory allocation and standard synchronization primitives within signal contexts.

## Architecture Overview
The module uses a Read-Copy-Update (RCU) pattern built on two complementary components:

**Custom Lock-Free Synchronization** (`half_lock.rs`): Provides `HalfLock<T>`, a specialized concurrent data structure that avoids standard mutexes in signal contexts using atomic pointers and dual-generation read-write synchronization.

**Signal Registry** (`lib.rs`): Implements the core signal multiplexing logic using `HalfLock` to maintain async-signal-safe access to signal handler data structures.

## Key Components and Data Flow

### Signal Registration Flow
1. **Public API**: `register()`, `register_sigaction()` (Unix), `register_unchecked()` variants
2. **Storage**: Actions stored in `SignalData` containing per-signal `Slot` structures with ordered callbacks (`BTreeMap<ActionId, Box<dyn Fn + Send + Sync>>`)
3. **Handler Installation**: Platform-specific signal handlers that chain previous handlers and execute registered actions
4. **Synchronization**: `HalfLock` ensures signal handlers can safely read data structures without blocking

### Lock-Free Read Pattern
Signal handlers use the reader path of `HalfLock`:
- Acquire `ReadGuard` without mutex contention
- Access current generation's data safely
- Automatic cleanup via RAII guard

### Safe Write Pattern  
Registration/unregistration uses writer path:
- `WriteGuard` provides exclusive write access
- `write_barrier()` drains readers before data updates
- Generation switching forces new readers to clean slot

## Public API Surface

### Primary Entry Points
- `register(signal, action) -> SigId` - Register simple callback
- `register_sigaction(signal, action) -> SigId` - Register with siginfo parameter (Unix only)  
- `register_unchecked(signal, action) -> SigId` - Bypass safety checks
- `unregister(sig_id) -> bool` - Remove specific registration

### Handle Types
- `SigId` - Public handle for registered actions, enables targeted removal
- `ActionId` - Internal identifier maintaining insertion order

## Platform Adaptation

**Unix Systems**:
- Full siginfo_t support through `register_sigaction()`
- Signal masking prevents race conditions
- Forbidden signals: SIGKILL, SIGSTOP, SIGILL, SIGFPE, SIGSEGV

**Windows Systems**:
- Limited to basic signal information
- Handler auto-reset requiring re-registration
- Race condition handling through fallback storage
- Forbidden signals: SIGILL, SIGFPE, SIGSEGV

## Internal Organization

### Data Structures Hierarchy
- `GlobalData` (singleton) → `HalfLock<SignalData>` → `HashMap<Signal, Slot>` → `BTreeMap<ActionId, Action>`

### Thread Safety Model
- Lock-free reads for signal handlers via `HalfLock`
- Exclusive writes for registration/unregistration
- RCU pattern ensures memory safety without signal-context allocation

## Key Patterns and Conventions

**Async-Signal-Safety**: All registered callbacks must follow async-signal-safe constraints (no allocation, no standard locks, no panicking).

**Execution Order**: Actions executed in registration order via `ActionId` sequencing in `BTreeMap`.

**Handler Chaining**: Previous signal handlers are preserved and called before registered actions.

**Conservative Memory Ordering**: Uses `SeqCst` atomic ordering throughout for correctness over performance.

The module provides the foundational infrastructure for higher-level signal handling libraries while maintaining the strict safety requirements of signal handler contexts.