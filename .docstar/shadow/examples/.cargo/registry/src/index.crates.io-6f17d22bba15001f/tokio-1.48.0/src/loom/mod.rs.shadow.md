# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/mod.rs
@source-hash: b14b9333a7a21bd1
@generated: 2026-02-09T18:06:36Z

## Purpose
Conditional abstraction module that switches between standard library synchronization primitives and Loom's mocked equivalents for testing concurrent code. Acts as a compile-time adapter layer to enable deterministic testing of async/concurrent behavior.

## Architecture
Uses conditional compilation to expose either:
- `std` module (L7-9): Standard library sync primitives for production builds
- `mocked` module (L12-14): Loom's testing framework primitives when running under test with loom feature

## Key Components
- **Conditional compilation gates** (L6, L11): `#[cfg(not(all(test, loom)))]` vs `#[cfg(all(test, loom))]` ensure mutually exclusive module selection
- **Re-export pattern** (L9, L14): Both modules are re-exported with `pub(crate) use` to provide uniform interface
- **Unused allow attribute** (L4): Permits dead code warnings since only one branch is active per build

## Dependencies
- `std` module: Standard library synchronization primitives
- `mocked` module: Loom testing framework for concurrent code verification
- Loom feature flag: Controls which implementation is active during testing

## Critical Invariants
- Exactly one module (std or mocked) is compiled and exposed per build configuration
- Interface compatibility between std and mocked implementations must be maintained
- Only active during test builds with loom feature enabled for deterministic concurrency testing