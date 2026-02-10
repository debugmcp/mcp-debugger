# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/aarch64/
@generated: 2026-02-09T18:16:13Z

## Purpose

This directory contains AArch64-specific type definitions, constants, and system interface bindings for GNU Linux systems within the libc crate. It provides the lowest-level platform abstraction layer for 64-bit ARM architecture, handling both the LP64 (64-bit long/pointer) and ILP32 (32-bit pointer on 64-bit) models through conditional compilation.

## Key Components and Organization

### Core Platform Definition (`mod.rs`)
The main module provides comprehensive AArch64 system interface definitions:
- **System Types**: Platform-specific type aliases (`wchar_t`, `nlink_t`, `suseconds_t`, etc.)
- **System Structures**: File system metadata (`stat`, `statfs`), signal handling (`sigaction`, `siginfo_t`), process/thread management (`pthread_attr_t`, `clone_args`)
- **Architecture-Specific Structures**: Register state (`user_regs_struct`), floating-point context (`user_fpsimd_struct`), machine context (`mcontext_t`)
- **Constants**: Error codes, signal definitions, file operation flags, memory protection flags, hardware capabilities
- **System Call Table**: Complete mapping of 460+ system calls from kernel interface

### Architecture Model Support
- **LP64 Model** (`lp64.rs`): 64-bit long/pointer variant with 48-byte pthread structures and specific mutex initializers
- **ILP32 Model** (`ilp32.rs`): 32-bit pointer variant with 32-byte pthread structures for memory-constrained environments

Both models provide:
- Pthread structure size constants (`__SIZEOF_PTHREAD_*`)
- Endian-specific mutex initializers for recursive, error-checking, and adaptive types
- Architecture-specific system call numbers

## Public API Surface

### Primary Entry Points
- **System Types**: All fundamental C types needed for system calls and library interfaces
- **Structure Definitions**: Complete AArch64-specific system structures for file operations, process management, signals, and IPC
- **Constants**: Error codes, signal numbers, file flags, memory protection flags, hardware capability flags
- **System Call Interface**: Direct access to kernel system call numbers for low-level operations

### Conditional Architecture Support
The module automatically selects the appropriate architecture model (LP64 vs ILP32) based on pointer width using `cfg_if!` conditional compilation.

## Internal Organization and Data Flow

1. **Base Definitions** (`mod.rs`): Core system interface types and structures
2. **Architecture Variants**: Platform-specific implementations based on memory model
   - `lp64.rs`: 64-bit pointer environments (standard desktop/server)
   - `ilp32.rs`: 32-bit pointer environments (embedded/memory-constrained)
3. **Endianness Handling**: Both variants provide separate initializers for little-endian and big-endian systems
4. **Conditional Assembly**: Final module composition based on target architecture characteristics

## Important Patterns and Conventions

### Endian-Aware Initialization
Mutex initializers place type values at different byte offsets based on target endianness:
- Little-endian: Type values at lower byte offsets
- Big-endian: Type values at higher byte offsets

### Memory Model Abstraction
The directory provides a clean abstraction over AArch64's dual memory models, allowing the same high-level libc interface to work across different ARM deployment scenarios.

### Hardware Feature Detection
Extensive hardware capability flags (`HWCAP_*`) enable runtime detection of AArch64-specific features like cryptographic extensions, vector processing capabilities, and memory protection features.

### System Call Completeness
Provides comprehensive system call number mapping ensuring compatibility with current and future Linux kernel interfaces on AArch64 platforms.