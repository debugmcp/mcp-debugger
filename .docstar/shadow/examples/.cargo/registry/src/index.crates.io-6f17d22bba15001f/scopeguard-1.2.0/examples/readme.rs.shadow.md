# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/scopeguard-1.2.0/examples/readme.rs
@source-hash: c6b1b458a130e091
@generated: 2026-02-09T18:11:46Z

## Purpose
Example file demonstrating `scopeguard` crate usage patterns for RAII-style resource management and cleanup in Rust, showing both macro and function-based approaches.

## Key Components

### Functions
- **`f()` (L6-11)**: Demonstrates `defer!` macro usage for panic-safe cleanup. Shows deferred println! execution that runs even when panic! occurs
- **`g()` (L16-24)**: Demonstrates `guard()` function for file resource management with automatic sync on scope exit. Creates a scope guard around a File that ensures sync_all() is called on drop
- **`main()` (L26-29)**: Entry point that exercises both demonstration functions

### Dependencies
- **`scopeguard` crate**: Imported with `defer` macro (L1-2) and `guard` function (L4)
- **`std::fs::File` and `std::io::Write`** (L13-14): For file I/O operations in the guard example

## Patterns & Architecture
- **RAII pattern**: Both examples show automatic cleanup regardless of normal return or panic
- **Macro vs function approach**: Contrasts `defer!` macro (declarative cleanup) with `guard()` function (resource wrapper)
- **Panic safety**: Demonstrates that cleanup code executes even during stack unwinding

## Key Behaviors
- `defer!` block (L7-9) executes after panic! (L10) during stack unwinding
- `guard()` wrapper (L18-21) allows transparent access to wrapped resource (L23) while ensuring cleanup closure runs on drop
- File operations include creation, writing, and automatic syncing via guard cleanup