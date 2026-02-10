# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/unwindsafe.rs
@source-hash: e833431d40708f39
@generated: 2026-02-09T18:12:34Z

## Purpose
Test file that verifies tokio types implement Rust's UnwindSafe and RefUnwindSafe traits, ensuring they can be safely used across panic boundaries. This is critical for async code that needs panic recovery guarantees.

## Test Structure
The file uses a helper function `is_unwind_safe<T>()` (L42) that constrains generic type `T` to implement both `UnwindSafe + RefUnwindSafe` traits. Each test calls this function with different tokio types, causing compile-time verification that the types satisfy unwind safety requirements.

## Key Test Functions
- `notify_is_unwind_safe()` (L7-9): Verifies `tokio::sync::Notify` synchronization primitive
- `join_handle_is_unwind_safe()` (L12-14): Verifies `tokio::task::JoinHandle<()>` task handles  
- `net_types_are_unwind_safe()` (L17-22): Verifies TCP/UDP networking types (`TcpListener`, `TcpSocket`, `TcpStream`, `UdpSocket`)
- `unix_net_types_are_unwind_safe()` (L25-30): Unix domain socket types, conditional on `#[cfg(unix)]`
- `windows_net_types_are_unwind_safe()` (L33-40): Windows named pipe types, conditional on `#[cfg(windows)]`

## Dependencies
- `std::panic::{RefUnwindSafe, UnwindSafe}` (L4): Core panic recovery traits
- Implicitly tests tokio types from `tokio::sync`, `tokio::task`, and `tokio::net` modules

## Platform Constraints
- Entire file excluded on WASI target (`#[cfg(all(feature = "full", not(target_os = "wasi")))]` L2) due to lack of panic recovery support
- Unix-specific tests (L25-30) and Windows-specific tests (L33-40) use appropriate conditional compilation

## Testing Pattern
Uses compile-time trait verification rather than runtime assertions - if any tested type doesn't implement the required traits, compilation fails, providing strong safety guarantees.