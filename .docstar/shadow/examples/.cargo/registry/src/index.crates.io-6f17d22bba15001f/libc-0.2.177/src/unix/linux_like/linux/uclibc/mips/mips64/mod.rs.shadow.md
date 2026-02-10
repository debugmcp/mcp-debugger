# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/mips/mips64/mod.rs
@source-hash: a35532d5ae376f40
@generated: 2026-02-09T17:57:14Z

## Purpose
Platform-specific type definitions and C structure bindings for MIPS64 architecture running uClibc on Linux. This module provides the foundational data types and system structures needed for FFI with the uClibc C library on MIPS64 systems.

## Key Type Definitions (L4-13)
- **Primitive types**: Maps C types to Rust equivalents for MIPS64/uClibc
  - `blkcnt_t`, `blksize_t` as `i64` - block count/size types
  - `fsblkcnt_t`, `fsfilcnt_t` as `c_ulong` - filesystem block/file count types  
  - `ino_t` as `u64`, `nlink_t` as `u64` - inode and link count types
  - `off_t` as `i64`, `time_t` as `i64` - offset and time types
  - `wchar_t` as `i32` - wide character type

## Critical System Structures
- **stat (L16-38)**: File status structure with MIPS64-specific padding and field layout
- **stat64 (L40-61)**: 64-bit file status variant using `off64_t` and `ino64_t`
- **pthread_attr_t (L63-65)**: Thread attributes with 7 `c_ulong` array storage
- **sigaction (L67-72)**: Signal handler configuration with MIPS64 field ordering
- **sigset_t (L80-82)**: Signal mask as 16 `c_ulong` array (128-bit mask)
- **siginfo_t (L84-90)**: Signal information with extensive padding for alignment

## IPC and Memory Management Structures
- **ipc_perm (L92-103)**: IPC permission structure with uClibc-specific layout
- **shmid_ds (L105-116)**: Shared memory segment descriptor
- **msqid_ds (L118-130)**: Message queue descriptor with glibc-reserved fields
- **statfs (L132-145)**: Filesystem statistics structure

## Networking and Terminal Structures  
- **msghdr (L147-155)**: Socket message header for sendmsg/recvmsg
- **cmsghdr (L157-161)**: Control message header for ancillary data
- **termios (L163-170)**: Terminal I/O settings structure

## System Information
- **sysinfo (L172-187)**: System statistics including memory, swap, and process info
- **sem_t (L192-194)**: Semaphore type with architecture-specific alignment

## Threading Constants (L197-202)
Size constants for pthread types specific to MIPS64/uClibc, used for proper memory allocation and ABI compatibility.

## System Call Numbers
- **SYS_gettid (L204)**: Thread ID syscall number (5178) for MIPS64 n64 ABI

## Dependencies
- Imports `off64_t` and common prelude from parent crate modules
- Relies on crate-defined types like `mode_t`, `uid_t`, `pid_t`, etc.

## Architecture Notes
- All structures use explicit padding fields to match uClibc's MIPS64 memory layout
- Field ordering and sizes are critical for C ABI compatibility
- The `s!` macro generates the struct definitions with proper FFI attributes