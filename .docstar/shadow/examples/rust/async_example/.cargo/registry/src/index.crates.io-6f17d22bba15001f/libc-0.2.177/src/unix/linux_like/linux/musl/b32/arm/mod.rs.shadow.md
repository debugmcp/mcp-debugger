# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/arm/mod.rs
@source-hash: 8df7c7015240f621
@generated: 2026-02-09T17:57:07Z

## Purpose and Responsibility
Platform-specific C type definitions and constants for ARM 32-bit architecture on musl libc Linux systems. This file provides low-level system interface bindings for ARM-specific data structures, error codes, signals, file operations, and system call numbers.

## Key Data Structures

### File System Structures
- **stat (L7-27)**: Standard file status structure with ARM-specific layout including padding fields `__st_dev_padding` and `__st_rdev_padding` for proper alignment
- **stat64 (L29-49)**: 64-bit variant of stat structure, identical layout to regular stat
- **stack_t (L51-55)**: Signal stack structure for alternate signal handling stack

### IPC Structures  
- **ipc_perm (L57-75)**: Inter-process communication permissions structure with conditional field naming based on musl version (musl_v1_2_3 cfg flag affects `__key` vs deprecated `__ipc_perm_key`)
- **shmid_ds (L77-91)**: Shared memory segment descriptor with ARM-specific padding fields
- **msqid_ds (L93-108)**: Message queue descriptor with similar ARM padding pattern

### Signal Context Structures
- **mcontext_t (L110-132)**: Machine context structure containing complete ARM register set (r0-r10, fp, ip, sp, lr, pc, cpsr) plus trap/fault information
- **ucontext_t (L136-143)**: User context structure for signal handling, uses `s_no_extra_traits!` macro and includes 64-element regspace array
- **max_align_t (L145-148)**: Maximum alignment type with 8-byte alignment requirement

## Type Definitions
- **wchar_t (L4)**: Defined as u32 for ARM architecture

## Implementation Patterns

### Conditional Trait Implementations (L151-173)
Uses `cfg_if!` macro to conditionally implement PartialEq, Eq, and Hash traits for ucontext_t when "extra_traits" feature is enabled. Hash implementation excludes the large `uc_regspace` field for performance.

### Architecture Constants
Extensive ARM-specific constant definitions including:
- Signal stack sizes: `SIGSTKSZ` (8192), `MINSIGSTKSZ` (2048) (L175-176)
- File operation flags with ARM-specific values (L178-262)
- Terminal control flags and baud rates (L188-253)
- Memory mapping flags (L264-273)
- Error codes matching ARM Linux kernel values (L278-362)
- Signal numbers and handling flags (L364-391)
- File control operations (L396-409)

### System Call Table (L413-791)
Complete ARM Linux system call number definitions from basic operations (exit=1, fork=2) to modern syscalls (mseal=462). Critical for low-level system programming and syscall interception.

## Dependencies
- Imports `off_t` and common prelude types from parent crate modules
- Uses `crate::` prefixed types extensively for type safety
- Relies on musl libc version detection via cfg flags

## Architectural Decisions
- Separate stat and stat64 structures despite identical layouts (maintaining ABI compatibility)
- ARM-specific padding fields in structures for proper memory alignment
- Version-aware field naming in ipc_perm structure with deprecation warnings
- Exclusion of large arrays from hash implementations for performance