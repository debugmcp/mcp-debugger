# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/m68k/mod.rs
@source-hash: 4c79cca606495e3d
@generated: 2026-02-09T17:57:06Z

**Purpose**: Architecture-specific constant and structure definitions for Motorola 68000 (m68k) architecture on 32-bit GNU/Linux systems. This module provides the low-level C bindings required for system calls, signal handling, file operations, and IPC on m68k platforms.

**Key Dependencies**: 
- `crate::prelude::*` (L1) - Common type definitions
- `crate::{off64_t, off_t}` (L2) - File offset types

**Core Type Definitions**:
- `wchar_t = i32` (L4) - Wide character type for m68k
- `max_align_t` (L164-168) - Memory alignment structure with 2-byte alignment and 20-byte size

**Critical System Structures**:
- `sigaction` (L9-14) - Signal handler configuration with function pointer, mask, flags, and optional restorer
- `statfs`/`statfs64` (L16-31, L84-97) - Filesystem statistics for 32-bit and 64-bit variants
- `flock`/`flock64` (L33-47) - File locking structures for record locking operations  
- `stat64` (L62-82) - Extended file status information with 64-bit support
- `ipc_perm` (L49-60) - IPC permission structure for shared memory/message queues
- `shmid_ds`/`msqid_ds` (L115-146) - Shared memory and message queue control structures
- `siginfo_t` (L148-154) - Signal information with 29-word padding and alignment
- `stack_t` (L156-160) - Signal stack configuration

**System Constants**:
- **File Operations** (L170-188): `O_*` flags for open(), including `O_DIRECT`, `O_LARGEFILE`, etc.
- **Memory Management** (L190-202): `MAP_*` and `MADV_*` constants for mmap() and madvise()
- **Error Codes** (L204-287): Comprehensive errno values from `EDEADLOCK` to `ERFKILL`
- **Signal Handling** (L289-340): Signal numbers, stack sizes, and control flags
- **Terminal I/O** (L341-433): Termios flags for baud rates, control modes, and line disciplines
- **System Calls** (L439-863): Complete SYS_* enumeration for m68k syscall interface

**Architecture Notes**:
- Uses 32-bit file offsets in base structures, 64-bit variants available
- Signal stack size: 8192 bytes, minimum 2048 bytes (L339-340)
- Special m68k syscalls: `SYS_atomic_cmpxchg_32`, `SYS_atomic_barrier` (L758-759)
- Legacy 16-bit UID/GID syscall variants included for compatibility

**Usage Context**: Essential for low-level system programming, FFI bindings, and kernel interface code targeting m68k GNU/Linux systems. Provides the fundamental constants and data structures needed for direct system call invocation and C library compatibility.