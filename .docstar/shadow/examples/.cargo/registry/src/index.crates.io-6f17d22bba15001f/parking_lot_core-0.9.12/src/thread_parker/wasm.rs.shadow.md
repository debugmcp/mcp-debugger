# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot_core-0.9.12/src/thread_parker/wasm.rs
@source-hash: 86e954d009d57d2d
@generated: 2026-02-09T18:06:22Z

## Purpose
WebAssembly platform-specific implementation of thread parking that panics on all parking operations due to lack of atomic support. This is a stub implementation that prevents parking functionality on WASM platforms.

## Key Components

### ThreadParker (L14)
- Zero-sized struct `ThreadParker(())` implementing `super::ThreadParkerT`
- **Construction**: `new()` (L21-23) creates empty instance, marked as cheap to construct (L19)
- **Parking Operations**: All parking methods panic with "Parking not supported on this platform":
  - `prepare_park()` (L25-27)
  - `timed_out()` (L29-31) 
  - `park()` (L33-35)
  - `park_until()` (L37-39)
  - `unpark_lock()` (L41-43)

### UnparkHandle (L46)
- Zero-sized struct implementing `super::UnparkHandleT`
- `unpark()` method (L49) is a no-op, does nothing safely

### Utility Function
- `thread_yield()` (L52-54): Delegates to `std::thread::yield_now()`

## Dependencies
- `std::thread` (L11): For yield functionality
- `std::time::Instant` (L12): For timeout parameter types
- Parent module traits: `super::ThreadParkerT` and `super::UnparkHandleT`

## Architecture
This is a platform-specific null implementation that satisfies the parking_lot_core interface while being unusable on WASM. All parking operations fail fast with panics rather than attempting unsupported operations. The design maintains type safety and interface compliance while clearly indicating platform limitations.