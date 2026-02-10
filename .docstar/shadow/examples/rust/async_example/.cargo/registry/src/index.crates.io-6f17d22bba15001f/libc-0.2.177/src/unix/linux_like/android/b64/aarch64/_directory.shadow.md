# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b64/aarch64/
@generated: 2026-02-09T18:16:13Z

## Purpose and Responsibility

This directory provides complete platform-specific C ABI compatibility definitions for 64-bit ARM Android (aarch64) systems within the libc crate. It serves as the low-level foundation enabling Rust programs to interface with Android's ARM64 kernel and system libraries through native system calls, file operations, and hardware-specific features.

## Key Components and Integration

The module is organized around several core functional areas that work together to provide comprehensive system interface coverage:

### Type System Foundation
- **Core C Types**: Defines fundamental types (`wchar_t`, `__u64`, `__s64`) that match Android ARM64 ABI requirements
- **Alignment Infrastructure**: Provides `max_align_t` for proper memory alignment (16-byte on ARM64)

### File System Interface Layer
- **Metadata Structures**: `stat` and `stat64` provide file system metadata access with 64-bit offsets and nanosecond timestamps
- **Operation Flags**: ARM64-specific file operation constants (`O_DIRECT`, `O_DIRECTORY`, `O_NOFOLLOW`, `O_LARGEFILE`) for fine-grained I/O control

### Process and Signal Management
- **CPU Context Preservation**: Complete register state management through `user_regs_struct`, `ucontext_t`, and `mcontext_t`
- **Signal Stack Configuration**: Defines stack size requirements (`SIGSTKSZ`, `MINSIGSTKSZ`) for signal handling
- **Floating-Point State**: `user_fpsimd_struct` manages ARM64 SIMD/floating-point register context

### Hardware Abstraction
- **Feature Detection**: Comprehensive HWCAP/HWCAP2 flags enable runtime detection of ARM64 capabilities (SVE, SME, cryptographic extensions, security features)
- **Memory Protection**: ARM64-specific protection flags (BTI, MTE) for modern security features

### System Call Interface
- **Complete Syscall Table**: Maps 300+ system calls from symbolic names to ARM64-specific numbers
- **Auxiliary Vector Support**: Provides vDSO and architecture-specific auxiliary vector definitions

## Public API Surface

The module exposes its functionality through:

1. **Type Definitions**: All structures and type aliases are public, enabling direct use in system programming
2. **Constants**: File operation flags, signal constants, hardware capability flags, and system call numbers
3. **ABI Structures**: Complete CPU context, file metadata, and signal handling structures
4. **Hardware Detection**: HWCAP flags for runtime feature discovery

## Internal Organization and Data Flow

The module follows a layered organization:
- **Foundation Layer**: Basic types and alignment requirements
- **System Interface Layer**: File operations, process management, memory protection
- **Hardware Abstraction Layer**: CPU context management and feature detection
- **Kernel Interface Layer**: Complete system call mapping

Data flows from high-level Rust code through these type-safe definitions down to raw system calls and hardware registers.

## Important Patterns and Conventions

- **ABI Compatibility**: All structures include proper padding and alignment for Android ARM64 ABI compliance
- **Feature Detection**: Hardware capabilities are exposed through bitflag constants for runtime feature checking
- **64-bit Consistency**: Both `stat` and `stat64` are identical on 64-bit systems, maintaining API compatibility
- **Security Integration**: Modern ARM64 security features (MTE, BTI, pointer authentication) are fully supported
- **Macro Usage**: Employs `s!` and `s_no_extra_traits!` macros for consistent structure definition patterns

## Role in Larger System

This module serves as the critical bridge between Rust's type system and Android's ARM64 kernel interface, enabling safe systems programming while maintaining full access to platform-specific features and optimizations. It forms the foundation upon which higher-level Android system APIs and native development frameworks are built.