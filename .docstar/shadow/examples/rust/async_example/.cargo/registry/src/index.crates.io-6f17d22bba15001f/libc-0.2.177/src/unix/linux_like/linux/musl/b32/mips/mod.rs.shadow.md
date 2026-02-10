# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/mips/mod.rs
@source-hash: 12c57cfa8eae992b
@generated: 2026-02-09T17:57:00Z

## Purpose

This module provides platform-specific type definitions and constants for 32-bit MIPS architecture running on Linux with musl libc. Part of the Rust libc crate's hierarchical platform support system.

## Key Components

### Type Definitions
- **wchar_t** (L4): Defined as `c_int` for MIPS32/musl compatibility

### Core Structures

**File System Metadata:**
- **stat** (L7-28): Standard file status structure with MIPS-specific layout including padding fields
- **stat64** (L30-51): 64-bit version using `ino64_t` and `blkcnt64_t` for large file support
- **statfs/statfs64** (L118-146): File system information structures

**System V IPC:**
- **ipc_perm** (L59-77): IPC permissions with conditional field naming based on musl version
- **shmid_ds** (L79-90): Shared memory segment descriptor
- **msqid_ds** (L92-116): Message queue descriptor with endian-specific field ordering

**Signal/Thread Support:**
- **stack_t** (L53-57): Signal stack specification
- **max_align_t** (L151-153): 8-byte aligned type for memory alignment

### Architecture-Specific Constants

**Signal Stack:**
- SIGSTKSZ: 8192 bytes (L156)
- MINSIGSTKSZ: 2048 bytes (L157)

**File Operations:** (L159-243)
- O_* flags for file opening modes
- Memory mapping flags (MAP_*)

**Error Codes:** (L255-339)
- Complete MIPS-specific errno definitions
- Network and system error constants

**Terminal I/O:** (L168-233)
- Comprehensive termios flags and constants
- Baud rate definitions up to 4Mbps

**System Calls:** (L392-775)
- Complete MIPS o32 ABI syscall numbers (base 4000)
- Includes modern syscalls like io_uring, landlock, futex_waitv

## Critical Architecture Details

- **MIPS o32 ABI**: All syscall numbers offset by 4000
- **Endianness handling**: msqid_ds structure has conditional field layout
- **musl version compatibility**: ipc_perm field naming varies by musl version
- **32-bit specific**: Uses standard sizes for off_t and related types

## Dependencies
- Imports `off_t` and common prelude from parent crate modules
- Relies on crate-level type aliases for portability

## Notable Patterns
- Extensive use of conditional compilation for musl version differences
- Systematic padding field naming convention (`__st_padding*`, `__unused*`)
- Deprecated syscall constants marked with version notes