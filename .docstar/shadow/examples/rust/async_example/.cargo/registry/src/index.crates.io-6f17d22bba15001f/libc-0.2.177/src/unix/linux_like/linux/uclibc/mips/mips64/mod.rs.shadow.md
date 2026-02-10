# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/mips/mips64/mod.rs
@source-hash: a35532d5ae376f40
@generated: 2026-02-09T17:56:57Z

## Purpose
Platform-specific type definitions and data structures for MIPS64 architecture on uClibc Linux systems. This is part of the libc crate's hierarchical type system providing low-level C bindings.

## Architecture Context
- Target: MIPS64 with uClibc on Linux
- Part of libc's unix/linux_like/linux/uclibc/mips/mips64 hierarchy
- Provides 64-bit specific type aliases and struct layouts

## Key Type Definitions (L4-13)
Essential C type aliases for MIPS64:
- `blkcnt_t`, `blksize_t` as `i64` - block count/size types
- `fsblkcnt_t`, `fsfilcnt_t` as `c_ulong` - filesystem block/file counts  
- `ino_t` as `u64` - inode numbers (64-bit)
- `off_t` as `i64` - file offsets
- `time_t` as `i64` - timestamps
- `wchar_t` as `i32` - wide character type

## Critical Data Structures

### File System Structures
- `stat` (L16-38): Standard file metadata with MIPS64-specific padding
- `stat64` (L40-61): 64-bit file metadata variant using `off64_t` and `ino64_t`
- `statfs` (L132-145): Filesystem statistics

### Inter-Process Communication
- `ipc_perm` (L92-103): IPC permission structure
- `shmid_ds` (L105-116): Shared memory descriptor
- `msqid_ds` (L118-130): Message queue descriptor

### Signal Handling
- `sigaction` (L67-72): Signal action configuration
- `sigset_t` (L80-82): Signal set (128-bit on MIPS64)
- `siginfo_t` (L84-90): Signal information
- `stack_t` (L74-78): Signal stack

### Threading & Synchronization  
- `pthread_attr_t` (L63-65): Thread attributes
- `sem_t` (L192-194): Semaphore type with alignment attributes

### Network Communication
- `msghdr` (L147-155): Socket message header
- `cmsghdr` (L157-161): Control message header

### System Information
- `termios` (L163-170): Terminal I/O settings
- `sysinfo` (L172-187): System information structure

## Architecture Constants (L197-203)
pthread object sizes specific to MIPS64:
- Mutex: 40 bytes, RWLock: 56 bytes, Barrier: 32 bytes
- Attribute objects: 4 bytes each

## Dependencies
- `crate::off64_t` - 64-bit offset type
- `crate::prelude::*` - Common C types and macros
- Various crate-level type definitions (ino_t, mode_t, uid_t, etc.)

## Key Patterns
- Uses `s!` macro for struct definitions (libc convention)
- Includes platform-specific padding fields (st_pad*, __unused*, etc.)
- Mix of public and private fields following C ABI requirements
- Conditional alignment attributes on `sem_t` based on pointer width