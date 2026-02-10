# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/mod.rs
@source-hash: 462ad708480340d2
@generated: 2026-02-09T18:06:53Z

## Primary Purpose
Central module declaration hub for Tokio's internal utility modules, organizing feature-gated utility components across the async runtime.

## Module Organization by Feature Gates

### Always Available Modules
- `metric_atomics` (L17): Performance monitoring atomic operations
- `wake` (L19-20): Core waker functionality, exports `waker` and `Wake`
- `trace` (L87): Tracing and debugging utilities
- `error` (L92): Error handling utilities
- `markers` (L97): Type markers and phantom types
- `cacheline` (L99): Cache-line alignment utilities

### Feature-Gated Modules
- `bit` (L1-3): IO driver bit manipulation (cfg_io_driver!)
- `as_ref` (L5-6): AsRef utilities for filesystem operations (#[cfg(feature = "fs")])
- `atomic_cell` (L8-9): Atomic cell implementation for runtime (#[cfg(feature = "rt")])
- `blocking_check` (L11-15): Socket blocking detection for networking (#[cfg(feature = "net")])
- `wake_list` (L22-46): Wake notification list for multiple features (net, process, sync, fs, rt, signal, time)
- `linked_list` (L48-58): Intrusive linked list for most features plus fuzzing
- `typeid` (L89-90): Type identification for filesystem (#[cfg(feature = "fs")])
- `memchr` (L94-95): Memory search utilities for IO (#[cfg(feature = "io-util")])
- `ptr_expose` (L101-103): Pointer exposure utilities (cfg_io_driver_impl!)

### Runtime-Specific Modules (cfg_rt!)
- `sharded_list` (L60-62): Sharded data structures for multi-threading
- `idle_notified_set` (L68-69): Idle notification tracking, exports `IdleNotifiedSet`
- `rand` (L64-65, L71): Random number generation, exports `RngSeedGenerator`
- Extended wake functionality (L73): `waker_ref`, `WakerRef`
- `sync_wrapper` (L75-76): Synchronization wrappers, exports `SyncWrapper`
- `rc_cell` (L78-79): Reference-counted cell, exports `RcCell`

### Multi-thread Runtime Modules (cfg_rt_multi_thread!)
- `try_lock` (L83-84): Non-blocking lock attempts, exports `TryLock`

## Key Utilities
- `pin_as_deref_mut` (L109-111): Pin deref utility function, temporary workaround for MSRV < 1.84

## Architectural Patterns
- Heavy use of feature gates for conditional compilation
- Centralized re-exports for internal crate visibility
- Modular design supporting different runtime configurations
- Clear separation between always-available and feature-specific utilities