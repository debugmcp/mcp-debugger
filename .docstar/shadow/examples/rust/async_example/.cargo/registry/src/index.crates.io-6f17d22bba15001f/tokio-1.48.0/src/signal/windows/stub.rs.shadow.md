# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/signal/windows/stub.rs
@source-hash: a6d3b11aa3a7247f
@generated: 2026-02-09T18:03:11Z

## Purpose
Cross-platform compatibility stub for Windows signal handling APIs. Provides panic-only implementations that allow rustdoc to generate complete documentation on non-Windows platforms without conditional compilation errors.

## Architecture Pattern
Uses stub pattern for cross-platform compatibility - all functions have identical signatures to their Windows counterparts but panic at runtime, ensuring documentation completeness while preventing accidental usage on unsupported platforms.

## Key Functions
- `ctrl_break()` (L7-9): Stub for Windows CTRL+BREAK signal handling
- `ctrl_close()` (L11-13): Stub for Windows console close signal handling  
- `ctrl_c()` (L15-17): Stub for Windows CTRL+C signal handling
- `ctrl_logoff()` (L19-21): Stub for Windows logoff signal handling
- `ctrl_shutdown()` (L23-25): Stub for Windows shutdown signal handling

All functions return `io::Result<RxFuture>` but immediately panic when called.

## Dependencies
- `crate::signal::RxFuture`: Future type for signal reception
- `std::io`: Standard I/O error handling

## Critical Constraints
- **Platform Safety**: All functions panic unconditionally - this code should never execute on actual systems
- **Documentation Only**: Exists solely to enable cross-platform documentation generation
- **Module Visibility**: All functions are `pub(super)` - accessible only to parent signal module