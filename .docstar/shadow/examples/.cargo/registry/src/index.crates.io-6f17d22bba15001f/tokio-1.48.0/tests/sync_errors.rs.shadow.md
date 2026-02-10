# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_errors.rs
@source-hash: 7a49ec77f4c967b3
@generated: 2026-02-09T18:12:28Z

## Primary Purpose
Test file that validates error types from Tokio's synchronization primitives implement the standard error trait bounds (`std::error::Error + Send + Sync`). Ensures error handling ergonomics across async synchronization APIs.

## Key Functions and Tests

### `is_error<T>()` (L7)
Generic constraint function that accepts only types implementing `std::error::Error + Send + Sync`. Used as a compile-time assertion mechanism - if called with a type lacking these bounds, compilation fails.

### `mpsc_error_bound()` (L9-15)
Tests MPSC (multi-producer, single-consumer) channel error types:
- `error::SendError<()>` (L13) - Error when sending fails
- `error::TrySendError<()>` (L14) - Error when non-blocking send fails

### `oneshot_error_bound()` (L17-23)
Tests oneshot channel error types:
- `error::RecvError` (L21) - Error when receiving fails
- `error::TryRecvError` (L22) - Error when non-blocking receive fails

### `watch_error_bound()` (L25-30)
Tests watch channel error types:
- `error::SendError<()>` (L29) - Error when watch send fails

## Configuration and Dependencies
- Requires `sync` feature flag (L2)
- WASM-compatible with conditional test runner import (L4-5)
- Uses Rust 2018 idioms linting (L1)

## Architectural Pattern
Follows compile-time verification pattern using generic constraints to ensure API consistency. Each test module corresponds to a Tokio sync primitive, systematically verifying error type conformance to standard error handling traits.