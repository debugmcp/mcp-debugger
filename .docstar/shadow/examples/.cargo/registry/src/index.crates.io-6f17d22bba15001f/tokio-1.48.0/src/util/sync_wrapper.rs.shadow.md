# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/sync_wrapper.rs
@source-hash: 9ef0d9e79ee3d5dd
@generated: 2026-02-09T18:06:50Z

## Purpose
A thread-safety wrapper that makes `Send + !Sync` types `Sync` by completely disallowing immutable access to the wrapped value. This is an internal utility for Tokio's concurrency primitives.

## Core Type
- **SyncWrapper<T>** (L8-10): Simple wrapper struct containing a single `value: T` field

## Key Methods
- **new()** (L21-23): Constructor that wraps a value of type `T`
- **into_inner()** (L25-27): Consumes the wrapper and returns the inner value
- **downcast_ref_sync()** (L32-36): Specialized method for `Box<dyn Any + Send>` that safely downcasts to `Sync` types

## Thread Safety Implementation
- **Send impl** (L14): Conditionally implements `Send` when `T: Send` - allows moving across thread boundaries
- **Sync impl** (L18): Unconditionally implements `Sync` for any `T` - safe because immutable references provide no access to inner value

## Key Constraints
- No methods provide immutable access (`&T`) to the inner value, preventing data races
- Only owned access (via `into_inner`) or controlled downcasting (for `Any` types) is allowed
- The safety model relies on the fact that immutable references to `SyncWrapper` are "useless"

## Dependencies
- `std::any::Any` (L6): Used for the specialized downcasting implementation

## Architectural Pattern
This follows the "make `Sync` by removing shared access" pattern, similar to the external `sync_wrapper` crate. The wrapper sacrifices shared immutable access to gain `Sync` bounds for types that are `Send` but not `Sync`.