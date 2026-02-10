# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/windows/handle.rs
@source-hash: f75276733a6f930f
@generated: 2026-02-09T18:03:15Z

## Handle - Windows HANDLE RAII Wrapper

**Primary Purpose**: Provides a Rust RAII wrapper around Windows HANDLE to ensure automatic resource cleanup through Drop trait implementation.

**Core Structure**:
- `Handle` struct (L5-6): Newtype wrapper around windows_sys HANDLE with automatic cleanup
- Implements Debug trait for diagnostics

**Key Methods**:
- `new(handle: HANDLE)` (L10-12): Constructor that wraps raw Windows HANDLE
- `raw()` (L14-16): Returns inner HANDLE for FFI calls without transferring ownership  
- `into_raw()` (L18-23): Consumes wrapper and returns RawHandle, using `mem::forget` to prevent Drop

**Resource Management**:
- `Drop` implementation (L26-29): Automatically calls `CloseHandle` on wrapped HANDLE when going out of scope
- Critical ownership transfer in `into_raw()` uses `mem::forget(self)` (L21) to prevent double-close

**Dependencies**:
- `windows_sys::Win32::Foundation` for HANDLE types and CloseHandle API
- `std::os::windows::io::RawHandle` for Windows-specific handle types

**Architecture Pattern**: 
- Classic RAII pattern ensuring Windows handles are properly closed
- Provides both borrowing (`raw()`) and ownership transfer (`into_raw()`) semantics
- Prevents resource leaks through automatic Drop implementation

**Critical Invariants**:
- Handle must only be closed once - `into_raw()` prevents Drop from running
- Assumes wrapped HANDLE is valid and owned by this wrapper