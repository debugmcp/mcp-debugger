# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/mips64.rs
@source-hash: d448cf011098728d
@generated: 2026-02-09T17:58:22Z

Platform-specific definitions for MIPS64 architecture on Linux with musl libc. Provides C type aliases, system structures, syscall numbers, and constants tailored for 64-bit MIPS systems.

## Type Definitions
Basic C type mappings (L4-8):
- `wchar_t` as `i32` (32-bit wide characters)
- `__u64`/`__s64` as `c_ulong`/`c_long` (64-bit integers)
- `nlink_t` as `c_uint` (file link count)
- `blksize_t` as `i64` (block size)

## Core System Structures
**File System Structures:**
- `stat` (L11-33): Standard file status with MIPS64-specific padding and field ordering
- `stat64` (L35-57): 64-bit version, identical to `stat` on this platform
- `statfs`/`statfs64` (L86-114): File system statistics with 64-bit variants for counters

**Process Management:**
- `stack_t` (L59-63): Signal stack definition
- `ipc_perm` (L65-84): IPC permissions with conditional field naming based on musl version

## Architecture-Specific Constants
**Stack Sizes (L117-118):**
- `SIGSTKSZ`: 8192 bytes
- `MINSIGSTKSZ`: 2048 bytes

**System Call Numbers (L120-474):**
All syscalls use base offset 5000, mapping to MIPS64 ABI. Key ranges:
- Basic I/O: 5000-5019 (read, write, open, etc.)
- Process management: 5055-5059 (clone, fork, execve, etc.)
- Modern syscalls: 5424+ (pidfd_send_signal, io_uring, etc.)

**File Operations (L476-489):**
MIPS64-specific O_* flags with unique values (O_DIRECT=0x8000, O_DIRECTORY=0x10000)

**Error Codes (L491-574):**
Extended POSIX errno values with MIPS-specific numbering

**Memory Mapping (L576-585):**
MAP_* constants for mmap() with MIPS64 values

**Signal Handling (L590-616):**
SA_* flags and signal numbers following MIPS conventions

**Terminal I/O (L618-706):**
Comprehensive termios constants including baud rates up to 4Mbps

## Dependencies
- Imports `off_t` and `prelude::*` from parent crate
- References standard libc types via `crate::` prefix

## Architecture Notes
This file represents the leaf-level platform bindings for MIPS64/musl, inheriting from the broader unix/linux_like hierarchy. The 5000-based syscall numbering is specific to MIPS64 architecture.