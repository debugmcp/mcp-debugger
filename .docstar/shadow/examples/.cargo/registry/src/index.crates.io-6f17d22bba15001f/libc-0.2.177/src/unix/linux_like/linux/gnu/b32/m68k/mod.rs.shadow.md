# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/m68k/mod.rs
@source-hash: 4c79cca606495e3d
@generated: 2026-02-09T17:57:10Z

## M68k-specific Linux GNU C Library Bindings

**Primary Purpose:** Platform-specific type definitions and constants for the M68k (Motorola 68000) architecture under 32-bit GNU Linux. This module provides low-level C FFI bindings tailored to the M68k memory layout and system ABI.

### Key Structures

**Core System Structures:**
- `sigaction` (L9-14): Signal handler configuration with M68k-specific layout including optional restorer function pointer
- `statfs`/`statfs64` (L16-31, L84-97): Filesystem statistics structures for 32-bit and 64-bit variants
- `flock`/`flock64` (L33-47): File locking structures using `off_t`/`off64_t` for different addressing modes
- `stat64` (L62-82): 64-bit file status structure with M68k padding and alignment
- `ipc_perm` (L49-60): Inter-process communication permissions with glibc-specific reserved fields

**IPC Structures:**
- `shmid_ds` (L115-129): Shared memory segment descriptor with M68k time_t layout
- `msqid_ds` (L131-146): Message queue descriptor with architecture-specific padding
- `siginfo_t` (L148-154): Signal information with 29-word padding array for M68k alignment
- `stack_t` (L156-160): Signal stack specification

**Special Types:**
- `max_align_t` (L164-167): 2-byte aligned structure with 20-byte private data
- `wchar_t` (L4): Defined as signed 32-bit integer for M68k

### Architecture-Specific Constants

**File Operations:** O_DIRECT (0x10000), O_LARGEFILE (0x20000), and other M68k-specific file flags (L174-188)

**Memory Management:** MAP_* constants for mmap operations with M68k-specific values (L191-202)

**Error Codes:** Complete errno mapping for M68k Linux (L204-287), including network and extended error codes

**Signal Handling:** M68k-specific signal numbers and masks (L289-340), with SIGSTKSZ=8192 and MINSIGSTKSZ=2048

**Terminal Control:** Comprehensive termios constants and baud rates up to 4Mbps (L341-437)

**System Calls:** Complete M68k system call number mapping (L439-863), including both legacy 16-bit UID variants and modern 32/64-bit versions

### Dependencies
- `crate::prelude::*`: Core libc type imports
- `crate::{off64_t, off_t}`: File offset types for different addressing modes

### Notable Architecture Decisions
- Uses 32-bit wchar_t (differs from some architectures)
- Maintains separate 16-bit and 32-bit UID/GID system call variants for compatibility
- Includes M68k-specific atomic operations (SYS_atomic_cmpxchg_32, SYS_atomic_barrier)
- Preserves deprecated system calls with clear deprecation markers