# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/dragonfly/errno.rs
@source-hash: 07b19390b9ae8f54
@generated: 2026-02-09T17:57:08Z

## Primary Purpose
Platform-specific errno implementation for DragonFlyBSD, providing thread-local error code access through deprecated `__error()` function and direct errno access.

## Key Components

### Functions
- `__error()` (L9-11): Deprecated function returning mutable pointer to thread-local errno. Returns `&mut errno` to maintain compatibility with expected C-style errno interface. Marked deprecated since v0.2.77 in favor of `__errno_location()`.

### External Declarations
- `errno` (L16): Thread-local static mutable C integer representing the system error code. Declared as `extern "C"` with `#[thread_local]` attribute for proper thread isolation.

## Dependencies
- `crate::prelude::*` (L1): Imports common libc types and macros
- Uses `f!` macro (L7) for function generation, likely from libc's internal macro system
- Depends on `c_int` type from prelude

## Architectural Decisions
- **Thread-local errno**: Uses Rust's `#[thread_local]` attribute instead of relying on platform's thread-local storage implementation
- **Inline compatibility**: Addresses DragonFlyBSD's "static inline" declaration of `__error` by implementing it directly in libc crate
- **Deprecation path**: Provides migration path from `__error()` to `__errno_location()` while maintaining backward compatibility

## Platform Context
DragonFlyBSD-specific implementation that differs from other BSD variants due to the platform's "static inline" errno function declaration, requiring direct implementation rather than external linkage.