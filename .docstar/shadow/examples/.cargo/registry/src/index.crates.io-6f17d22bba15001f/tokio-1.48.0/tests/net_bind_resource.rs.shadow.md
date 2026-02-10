# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/net_bind_resource.rs
@source-hash: b8681620174393f6
@generated: 2026-02-09T18:12:17Z

## Purpose
Test file verifying that tokio's `TcpListener::try_from()` panics when called outside a tokio runtime context. This is a negative test ensuring proper error handling for resource binding operations.

## Key Components
- **Test Function** `no_runtime_panics_binding_net_tcp_listener()` (L11-14): Creates a standard library TCP listener and attempts to convert it to a tokio TcpListener without a runtime, expecting a panic.

## Dependencies
- `tokio::net::TcpListener` (L4): Tokio's async TCP listener type
- `std::net` (L6): Standard library networking primitives

## Test Configuration
- **Platform Restrictions** (L2): Excludes WASI targets (no panic recovery or bind support)
- **Feature Gates**: Requires "full" tokio feature set
- **Miri Exclusion** (L10): Ignored under Miri due to missing socket support
- **Expected Behavior**: `#[should_panic]` attribute (L9) validates runtime requirement

## Architecture Notes
- Tests the invariant that tokio network resources require an active runtime
- Uses localhost binding (`127.0.0.1:0`) for isolated testing
- Demonstrates proper separation between std and tokio networking types