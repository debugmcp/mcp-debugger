# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot_core-0.9.12/src/util.rs
@source-hash: 285e613315064552
@generated: 2026-02-09T18:11:38Z

## Purpose
Utility module providing unsafe optimization helpers for the parking_lot_core crate. Contains performance-critical operations that bypass standard safety checks when the caller can guarantee preconditions.

## Key Components

### UncheckedOptionExt Trait (L9-11)
Extension trait adding `unchecked_unwrap()` method to `Option<T>`. Provides unsafe unwrapping without panic checks when caller guarantees the Option contains `Some(value)`.

### Option<T> Implementation (L13-21)
- **unchecked_unwrap()** (L15-20): Unsafe method that extracts value from Option without checking for None
- Uses pattern matching but delegates to `unreachable()` for None case
- Marked `#[inline]` for performance optimization
- **Safety contract**: Caller must guarantee Option is Some variant

### unreachable() Function (L24-31)
Private helper function providing conditional unreachable hints:
- **Debug builds**: Uses `unreachable!()` macro (panics with helpful message)
- **Release builds**: Uses `core::hint::unreachable_unchecked()` (undefined behavior if reached)
- Marked `#[inline]` and `unsafe` - calling with reachable code path causes UB in release mode

## Architecture Notes
- Follows Rust's zero-cost abstraction principle - no runtime overhead in release builds
- Debug/release behavior divergence allows catching logic errors during development while maximizing performance in production
- Part of parking_lot's low-level synchronization primitives where performance is critical

## Dependencies
- `core::hint::unreachable_unchecked` for release-mode optimization
- Standard library macros for debug assertions