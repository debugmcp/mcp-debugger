# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot_core-0.9.12/src/thread_parker/windows/bindings.rs
@source-hash: 9dcfff2470db0424
@generated: 2026-02-09T18:02:28Z

## Purpose and Responsibility

This file provides manual Win32 API bindings for the `parking_lot_core` thread parking implementation on Windows. It intentionally avoids external dependencies like `windows-sys` or `winapi` since `parking_lot_core` is a foundational Rust ecosystem dependency where dependency minimization is critical.

## Key Constants and Types

**Win32 Constants (L8-13):**
- `INFINITE` (L8): Maximum timeout value for infinite waits
- `ERROR_TIMEOUT` (L9): Windows error code for timeout conditions  
- `GENERIC_READ/WRITE` (L10-11): File access permissions for handle creation
- `STATUS_SUCCESS/TIMEOUT` (L12-13): NT status codes for operation results

**Type Aliases (L15-28):**
- `HANDLE`, `HINSTANCE` (L15-16): Windows handle types as `isize`
- `BOOL`, `BOOLEAN` (L17-18): Windows boolean types (`i32` and `u8`)
- `NTSTATUS` (L19): NT status return type
- `FARPROC` (L20): Function pointer type for dynamically loaded procedures
- `WaitOnAddress` (L21-26): Function pointer type for address-based waiting
- `WakeByAddressSingle` (L27): Function pointer type for single-address wake operations

## External Function Bindings

**Kernel32.dll Functions (L29-33):**
- `GetLastError` (L29): Retrieves last Win32 error code
- `CloseHandle` (L30): Closes Windows handles
- `GetModuleHandleA` (L31): Gets module handle by name
- `GetProcAddress` (L32): Dynamically loads function addresses
- `Sleep` (L33): Thread sleep functionality

## Architectural Decisions

- Uses `windows_link::link!` macro for dynamic linking to kernel32.dll functions
- Manual bindings strategy eliminates transitive dependencies that could impact ecosystem
- Function pointer types (`WaitOnAddress`, `WakeByAddressSingle`) suggest runtime feature detection for newer Windows APIs
- All functions use "system" calling convention for Win32 compatibility