# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/windows/overlapped.rs
@source-hash: 94fa619a76552284
@generated: 2026-02-09T18:03:13Z

## Purpose
Windows-specific wrapper for Win32 `OVERLAPPED` structures used in asynchronous I/O operations. Provides a safe Rust interface to Windows overlapped I/O with callback functionality for event handling.

## Key Components

### Overlapped Struct (L8-12)
- `#[repr(C)]` ensures C-compatible memory layout for FFI
- `inner: UnsafeCell<OVERLAPPED>` - Raw Windows OVERLAPPED structure wrapped for interior mutability
- `callback: fn(&OVERLAPPED_ENTRY, Option<&mut Vec<Event>>)` - Function pointer for handling completed I/O operations

### Implementation Methods (L15-26)
**Feature-gated implementation** (`#[cfg(feature = "os-ext")]`):
- `new()` (L16-21) - Constructor that zero-initializes the OVERLAPPED structure using `std::mem::zeroed()`
- `as_ptr()` (L23-25) - Returns raw pointer to the inner OVERLAPPED structure for FFI calls

### Trait Implementations
- `Debug` (L28-32) - Minimal debug representation (doesn't expose internal state)
- `Send + Sync` (L34-35) - Unsafe marker traits enabling cross-thread usage

## Dependencies
- `windows_sys` crate for Win32 API bindings (`OVERLAPPED`, `OVERLAPPED_ENTRY`)
- Local `Event` type from parent Windows system module

## Critical Constraints
- Zero-initialization of OVERLAPPED structure is required for proper Windows API usage
- Unsafe cell enables interior mutability while maintaining thread safety guarantees
- C representation ensures proper FFI compatibility with Windows system calls
- Feature gate limits availability to builds with `os-ext` feature enabled