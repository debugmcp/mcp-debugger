# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/mips/mips64/
@generated: 2026-02-09T18:16:16Z

## Purpose
This directory provides comprehensive MIPS64 architecture-specific type definitions and system structure bindings for the uClibc C library on Linux. It serves as a critical FFI (Foreign Function Interface) layer that enables Rust code to interact safely and correctly with uClibc system calls, library functions, and kernel interfaces on MIPS64 platforms.

## Architecture Specialization
The module specifically targets the MIPS64 architecture running uClibc (a lightweight C library for embedded systems) on Linux, representing one of the most specialized platform combinations in the libc crate hierarchy. This level of specificity ensures precise ABI (Application Binary Interface) compatibility with the target system's C library implementation.

## Key Components and Organization

### Core Type Mapping (mod.rs)
- **Primitive Type Definitions**: Maps fundamental C types to appropriate Rust equivalents for MIPS64/uClibc
  - File system types (`blkcnt_t`, `fsblkcnt_t`, `ino_t`, `off_t`)
  - Time and character types (`time_t`, `wchar_t`)
  - Link and size types (`nlink_t`, `blksize_t`)

### Critical System Structures
- **File System Interface**: `stat`, `stat64`, `statfs` structures for file operations
- **Threading Support**: `pthread_attr_t`, `sem_t` with MIPS64-specific sizing
- **Signal Handling**: `sigaction`, `sigset_t`, `siginfo_t` with proper field ordering
- **IPC Mechanisms**: `ipc_perm`, `shmid_ds`, `msqid_ds` for inter-process communication
- **Network Communication**: `msghdr`, `cmsghdr` for socket operations
- **Terminal Control**: `termios` for terminal I/O configuration
- **System Monitoring**: `sysinfo` for system statistics and resource information

## Public API Surface
The module exposes all type definitions and structures as public items, making them available to:
- Higher-level libc functions that operate on these types
- User code requiring direct system call interfaces
- FFI code needing precise C structure layout compatibility

Key entry points include:
- File operations via `stat`/`stat64` structures
- Threading primitives through `pthread_attr_t` and `sem_t`
- Signal handling via `sigaction` and related types
- IPC through shared memory and message queue descriptors

## Internal Organization and Data Flow
The module follows a pattern of:
1. **Type Aliasing**: Mapping C primitive types to Rust equivalents
2. **Structure Definition**: Using the `s!` macro to generate FFI-compatible struct definitions
3. **Constant Definition**: Providing architecture-specific constants (threading sizes, syscall numbers)

All structures include explicit padding fields to match uClibc's MIPS64 memory layout, ensuring binary compatibility with C code.

## Critical Patterns and Conventions
- **ABI Compatibility**: Every structure uses explicit field ordering and padding to match the C library's expectations
- **Architecture Awareness**: Field sizes and alignments are specific to MIPS64's 64-bit architecture
- **uClibc Specifics**: Structure layouts may differ from glibc, requiring dedicated definitions
- **FFI Safety**: All types are designed for safe cross-language data exchange

## System Integration
This module integrates with the broader libc ecosystem by:
- Providing the foundational types that higher-level functions depend on
- Enabling system call wrappers to use correct argument and return types
- Supporting both standard POSIX interfaces and Linux-specific extensions
- Maintaining compatibility with the MIPS64 n64 ABI (as evidenced by syscall number SYS_gettid = 5178)

The module represents the lowest level of platform-specific abstraction in the libc crate, directly interfacing with the operating system and C library while providing a safe, typed interface for Rust applications.