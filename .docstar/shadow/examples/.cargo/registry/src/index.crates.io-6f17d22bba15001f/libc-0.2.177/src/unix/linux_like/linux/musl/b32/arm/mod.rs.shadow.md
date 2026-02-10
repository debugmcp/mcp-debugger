# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/arm/mod.rs
@source-hash: 8df7c7015240f621
@generated: 2026-02-09T17:57:15Z

This file contains ARM 32-bit specific type definitions and constants for the musl libc library on Linux systems. It serves as a platform-specific layer providing C FFI bindings for ARM architecture.

## Core Purpose
Defines ARM-specific system types, structures, and constants to enable Rust code to interface with Linux system calls and C libraries on 32-bit ARM platforms using musl libc.

## Key Type Definitions
- **wchar_t** (L4): Wide character type defined as u32 for ARM
- **stat** struct (L7-27): File status structure with ARM-specific field layout including device IDs, file metadata, timestamps with nanosecond precision
- **stat64** struct (L29-49): 64-bit file status structure, identical layout to stat for this platform
- **stack_t** struct (L51-55): Signal stack configuration structure
- **ipc_perm** struct (L57-75): Inter-process communication permissions with conditional field naming based on musl version
- **shmid_ds** struct (L77-91): Shared memory segment descriptor
- **msqid_ds** struct (L93-108): Message queue descriptor
- **mcontext_t** struct (L110-132): ARM machine context with all ARM registers (r0-r10, fp, ip, sp, lr, pc, cpsr)
- **ucontext_t** struct (L136-143): User context structure with signal mask and register space
- **max_align_t** struct (L145-148): Maximum alignment type with 8-byte alignment

## Platform-Specific Features
- ARM register naming convention in mcontext_t (arm_r0 through arm_cpsr)
- Conditional compilation for musl version compatibility in ipc_perm struct
- Large register space allocation (64 c_ulonglong entries) in ucontext_t
- Custom PartialEq/Eq/Hash implementations for ucontext_t when extra_traits feature enabled (L153-172)

## System Constants
- **Signal stack sizes**: SIGSTKSZ=8192, MINSIGSTKSZ=2048 (L175-176)
- **File operation flags**: O_DIRECT, O_DIRECTORY, O_LARGEFILE, etc. (L178-262)
- **Memory management**: MADV_*, MCL_*, MAP_* constants (L184-273)
- **Terminal I/O**: Comprehensive termios constants for baud rates, control flags (L188-253)
- **Error codes**: Complete errno definitions for ARM (L278-362)
- **Signal handling**: Signal numbers and SA_* flags (L364-392)
- **File locking**: F_GETLK, F_SETLK operations (L396-400)
- **System call numbers**: Complete syscall table for ARM (L413-792)

## Dependencies
- Imports `crate::off_t` and `crate::prelude::*`
- References various crate-level types (dev_t, mode_t, uid_t, etc.)
- Uses cfg_if macro for conditional compilation
- Requires hash module when extra_traits feature enabled

## Architecture Notes
This is the leaf module in the hierarchy: unix/linux_like/linux/musl/b32/arm/, making it highly specific to ARM 32-bit musl systems. The syscall numbers and structure layouts must exactly match the ARM Linux kernel ABI.