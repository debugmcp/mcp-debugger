# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/windows/io_status_block.rs
@source-hash: 052095e6b312244f
@generated: 2026-02-09T18:03:15Z

## Purpose
Windows-specific wrapper for Win32 IO_STATUS_BLOCK structure used in asynchronous I/O operations. Provides safe Rust interface to Windows kernel I/O status reporting mechanism.

## Key Components

### IoStatusBlock Struct (L6)
- Newtype wrapper around `windows_sys::Win32::System::IO::IO_STATUS_BLOCK`
- Thread-safe via explicit `Send` implementation (L21)
- Provides transparent access to underlying Win32 structure via `Deref`/`DerefMut` traits

### Constructor (L12-17)
- `zeroed()`: Creates zero-initialized IO_STATUS_BLOCK instance
- Only available when `cfg_io_source` feature is enabled (L8-19)
- Initializes both `Status` field (via Anonymous union) and `Information` field to 0

### Trait Implementations
- `Deref`/`DerefMut` (L23-34): Direct access to underlying `IO_STATUS_BLOCK`
- `Debug` (L36-40): Simple debug representation without exposing internal fields
- `Send` (L21): Explicitly marked as thread-safe for cross-thread I/O operations

## Dependencies
- `windows_sys::Win32::System::IO::{IO_STATUS_BLOCK, IO_STATUS_BLOCK_0}`: Core Win32 I/O types
- Standard library: `fmt`, `ops::{Deref, DerefMut}`

## Usage Context
This wrapper is used in Windows async I/O completion mechanisms where the kernel writes operation status and byte counts. The zero-initialization ensures clean starting state for overlapped I/O operations.