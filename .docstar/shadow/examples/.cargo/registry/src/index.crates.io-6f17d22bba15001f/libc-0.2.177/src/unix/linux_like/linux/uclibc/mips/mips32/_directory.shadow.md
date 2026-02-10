# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/mips/mips32/
@generated: 2026-02-09T18:16:06Z

## MIPS 32-bit uClibc Platform Module

This directory provides comprehensive platform-specific bindings for MIPS 32-bit architecture running with uClibc (micro C library) on Linux systems. It serves as the lowest-level interface layer between Rust code and the underlying MIPS32/uClibc system ABI.

### Overall Purpose

The module encapsulates all platform-specific details needed for Rust programs to interact with MIPS 32-bit uClibc systems, including:
- C type definitions matching the target platform's ABI
- System call number mappings for the MIPS O32 calling convention
- Data structures for kernel interfaces (files, processes, IPC, threading)
- External library function bindings

### Key Components

**Type System Foundation:**
- Primitive type aliases (`clock_t`, `time_t`, `ino_t`, etc.) that map Rust types to exact C equivalents
- Both 32-bit and 64-bit variants where needed for large file/filesystem support

**System Interface Structures:**
- File system operations: `stat`, `stat64`, `statvfs64`, `statfs` families
- Process/thread management: `pthread_attr_t`, `sigaction`, `sigset_t`, `siginfo_t`
- Inter-process communication: `ipc_perm`, `shmid_ds`, `msqid_ds`
- System information and control: `sysinfo`, `flock`, `sem_t`

**System Call Mapping:**
- Complete MIPS O32 system call number definitions (4000+ offset)
- Coverage from basic operations (`exit`, `read`, `write`) to modern kernel features (`io_uring`, `landlock`)
- Proper handling of deprecated system calls

**External Library Integration:**
- Bindings to util library functions for system control and threading
- CPU affinity management and pathname expansion utilities

### Public API Surface

The module exports its interface through the standard libc crate patterns:
- Type definitions available for direct use in unsafe FFI code
- System call constants for manual syscall invocation
- Structure definitions for kernel data exchange
- External function declarations for linked library calls

### Architecture-Specific Considerations

**MIPS O32 ABI Compliance:**
- 32-bit pointer and integer sizes throughout
- Proper structure padding and alignment for MIPS requirements
- Endian-aware layouts where necessary (e.g., message queue structures)

**uClibc Integration:**
- Structure sizes and layouts optimized for the lightweight uClibc implementation
- pthread object sizing constants specific to uClibc's threading implementation
- Memory-efficient data structure definitions

### Usage Patterns

This module is typically consumed indirectly through higher-level libc crate abstractions, but provides the foundational definitions that enable:
- File system operations and metadata access
- Process creation and signal handling
- Inter-process communication mechanisms
- Threading and synchronization primitives
- Direct system call invocation when needed

The module follows Rust's FFI safety conventions while providing complete access to the underlying MIPS32/uClibc system interface.