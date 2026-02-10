# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/sparc/mod.rs
@source-hash: d8fc8800d01891bb
@generated: 2026-02-09T17:57:06Z

## Primary Purpose

SPARC-specific architecture definitions for 32-bit Linux systems using GNU libc. Provides platform-specific type definitions, system structures, constants, and syscall numbers tailored for the SPARC processor architecture on Linux.

## Key Type Definitions

**Basic Types:**
- `wchar_t` (L6): 32-bit signed integer for wide characters

**System Structures:**
- `sigaction` (L11-16): Signal handling configuration with function pointer, mask, flags, and optional restorer
- `statfs` (L18-33): File system statistics with block counts, file counts, and metadata
- `statfs64` (L112-125): 64-bit version with extended counters using u64 types
- `siginfo_t` (L35-41): Signal information with 29-word padding and alignment
- `flock`/`flock64` (L43-58): File locking structures for 32-bit and 64-bit offsets
- `stack_t` (L60-64): Signal stack configuration
- `stat`/`stat64` (L66-110): File status structures with conditional padding based on `gnu_file_offset_bits64`
- `statvfs64` (L127-141): VFS statistics with 64-bit counters
- `ipc_perm` (L143-155): IPC permissions structure
- `shmid_ds` (L157-177): Shared memory segment descriptor with time-dependent layout
- `msqid_ds` (L179-197): Message queue descriptor with conditional padding
- `max_align_t` (L200-205): Maximum alignment type with 8-byte alignment

## Architecture-Specific Constants

**File Operations (L207-220):**
- Terminal control: `VEOF = 4`
- Runtime linking: `RTLD_*` flags
- File opening: `O_*` flags with SPARC-specific values

**Memory Management (L222-232):**
- Memory advice and mapping flags optimized for SPARC

**Error Codes (L234-374):**
- Complete errno definitions with SPARC-specific numeric values
- Network and IPC error codes

**Signal Handling (L316-341):**
- Signal numbers and masks specific to SPARC architecture
- Process control signals with unique numbering

**Terminal I/O (L343-474):**
- Baud rates, control flags, and terminal settings
- SPARC-specific `tcflag_t` and `speed_t` values

**System Call Numbers (L476-865):**
- Complete syscall table for SPARC 32-bit Linux
- Includes modern syscalls up to `set_mempolicy_home_node` (450)
- Some syscalls marked as deprecated or reserved

## Dependencies

- `crate::prelude::*`: Core type imports
- `crate::{off64_t, off_t}`: File offset types
- Various `crate::*` types for system identifiers and primitives

## Architecture Notes

- Uses `s!` and `s_no_extra_traits!` macros for structure definitions
- Conditional compilation based on `gnu_file_offset_bits64` and `gnu_time_bits64`
- SPARC-specific memory layout and padding requirements
- Complete syscall coverage for userspace-kernel interface