# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/x86_64/mod.rs
@source-hash: 95b8adc3443988aa
@generated: 2026-02-09T17:57:18Z

Platform-specific type definitions and constants for x86_64 musl libc on Linux. This file provides C ABI compatibility layer for 64-bit x86 architecture running musl C library.

## Primary Purpose
Defines platform-specific types, structures, system call numbers, and constants needed for low-level system programming on x86_64 musl Linux systems.

## Key Type Definitions (L4-9)
- `wchar_t = i32`: Wide character type for x86_64 musl
- `nlink_t = u64`: File link count type  
- `blksize_t = c_long`: Block size type
- `__u64 = c_ulonglong`: Unsigned 64-bit kernel type
- `__s64 = c_longlong`: Signed 64-bit kernel type
- `greg_t = i64`: General register type for signal contexts

## Core Structures

### File System Structures (L12-52)
- `stat` (L12-31): Standard file metadata structure with device, inode, size, timestamps
- `stat64` (L33-52): 64-bit variant using `ino64_t` and `blkcnt64_t` for large file support

### Process/Debug Structures (L54-104)
- `user_regs_struct` (L54-82): Complete x86_64 register set for debugging/ptrace
- `user` (L84-104): Process debugging structure containing registers, memory layout info

### Signal/Context Structures (L109-177)
- `mcontext_t` (L109-112): Machine context for signal handling with 23 general registers
- `ucontext_t` (L165-172): User context including stack, signal mask, machine context
- `user_fpregs_struct` (L151-163): x86_64 floating point register state

### IPC Structure (L114-132)
- `ipc_perm` (L114-132): IPC permissions with version-dependent field naming

### Process Creation (L135-147)
- `clone_args` (L135-147): Modern process creation arguments for clone3 syscall

## System Call Table (L251-617)
Comprehensive x86_64 Linux syscall number definitions from 0 (read) to 462 (mseal). Includes deprecated syscalls with deprecation annotations (L425-432).

## Register Offset Constants
- `user_regs_struct` offsets (L620-646): For ptrace register access
- `mcontext_t.gregs` offsets (L652-674): For signal context register access

## Platform Constants
- Memory mapping flags (L677-834): x86_64-specific mmap options
- File operation flags (L678-690): O_DIRECT, O_LARGEFILE, etc.
- Error codes (L698-780): Extended errno values for musl
- Signal constants (L782-808): Signal numbers and handling flags
- Terminal I/O (L839-914): Termios flags and baud rates

## Dependencies
- `crate::off_t`, `crate::prelude::*` (L1-2)
- Various crate-level types like `dev_t`, `ino_t`, `mode_t`

## Architectural Notes
- Uses `s!` macro for standard structs with auto-derived traits
- Uses `s_no_extra_traits!` for structs requiring custom trait implementations
- Conditional compilation for `extra_traits` feature providing PartialEq/Hash
- Version-specific handling for musl library evolution (ipc_perm field naming)