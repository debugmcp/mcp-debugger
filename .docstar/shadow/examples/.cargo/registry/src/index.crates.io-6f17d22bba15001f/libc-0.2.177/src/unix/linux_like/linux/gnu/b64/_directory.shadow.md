# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/
@generated: 2026-02-09T18:16:47Z

## Directory Purpose and Responsibility

This directory provides comprehensive 64-bit architecture-specific implementations for GNU Linux systems within the libc crate's Unix abstraction hierarchy. Located at the leaf level of the platform hierarchy (`unix/linux_like/linux/gnu/b64`), it serves as the foundational platform abstraction layer that bridges Rust applications with the underlying 64-bit GNU/Linux kernel ABI across multiple CPU architectures.

The directory implements the complete set of architecture-specific type definitions, system call interfaces, and platform constants needed for systems programming on 64-bit GNU Linux platforms, ensuring binary compatibility with GNU C library while providing type-safe Rust interfaces.

## Key Components and Architecture Integration

### Base Module and Architecture Selection
- **`mod.rs`**: Provides common 64-bit GNU Linux definitions and orchestrates conditional compilation to select appropriate architecture-specific modules
- **Architecture-Specific Modules**: Each subdirectory (`aarch64`, `x86_64`, `sparc64`, `mips64`, `powerpc64`, `riscv64`, `loongarch64`, `s390x`) contains complete platform implementations
- **Conditional Compilation Framework**: Uses `cfg_if!` and target-specific cfg attributes to automatically select the correct architecture at compile time

### Unified System Interface Layer
All architecture modules follow consistent patterns while handling platform-specific requirements:
- **System Types**: Architecture-appropriate primitive type mappings (`wchar_t`, `nlink_t`, `blksize_t`, etc.)
- **Core Structures**: Platform-specific layouts for file operations (`stat`, `statfs`, `flock`), signal handling (`sigaction`, `siginfo_t`), and process management (`pthread_attr_t`, `clone_args`)
- **Hardware Context**: Architecture-specific register state and floating-point context structures for debugging and signal handling
- **System Call Interface**: Complete syscall number mappings with architecture-specific offsets and numbering schemes

### Multi-Model Support
Several architectures support multiple execution models:
- **AArch64**: LP64 (64-bit pointers) and ILP32 (32-bit pointers) variants for different deployment scenarios
- **x86_64**: Standard 64-bit and x32 ABI (32-bit pointers on 64-bit) support
- **Endianness Handling**: Big-endian and little-endian variants where architecturally relevant

## Public API Surface

### Primary Entry Points
- **Type Definitions**: Complete set of C-compatible type aliases for each architecture
- **System Structures**: All major OS interface structures with proper memory layout and padding
- **System Call Constants**: Platform-specific syscall numbers (SYS_* family) for direct kernel interaction
- **Platform Constants**: Architecture-specific error codes, signal numbers, file operation flags, memory management constants

### Cross-Architecture Consistency
Despite architectural differences, all modules provide consistent interfaces:
- **File System Operations**: `stat`, `statfs`, `flock` families with 32/64-bit variants
- **Signal Handling**: `sigaction`, `siginfo_t`, signal constants and stack definitions
- **Threading Primitives**: `pthread_attr_t` and synchronization object initializers with endian-aware configurations
- **Memory Management**: Memory mapping flags, alignment requirements, and hardware capability detection

### External Function Interfaces
- **Context Management**: `getcontext`/`setcontext` family for user context switching
- **System Control**: `sysctl` interface for kernel parameter access
- **Architecture Extensions**: Platform-specific functions for hardware feature access

## Internal Organization and Data Flow

### Hierarchical Type System
The directory operates within libc's type hierarchy:
1. **Base Platform Types** → **Architecture-Specific Specializations** → **Application Interface**
2. **Generic 64-bit Definitions** → **Platform Overrides** → **Final Implementation**
3. **Common Patterns** → **Architecture Adaptations** → **Binary Compatibility**

### Conditional Compilation Strategy
Each architecture module integrates through:
- **Automatic Selection**: Target triple-based architecture detection
- **Feature Flags**: Optional functionality through cargo features
- **ABI Variants**: Compile-time selection of execution models (LP64/ILP32, standard/x32)

### Binary Compatibility Assurance
All modules ensure exact C ABI compatibility through:
- **Explicit Layout Control**: `#[repr(C)]` structures with precise field ordering
- **Padding Management**: Architecture-appropriate alignment and padding fields
- **Type Size Verification**: Compile-time assertions for structure sizes
- **Endianness Handling**: Proper byte order considerations for multi-endian architectures

## Important Patterns and Conventions

### Macro-Driven Structure Definitions
- Consistent use of `s!` and `s_no_extra_traits!` macros for structure layout
- Automated trait derivation with special handling for comparison operations on structures with arrays

### Comprehensive System Coverage
- Complete errno code mappings for each architecture
- Exhaustive syscall number definitions including modern kernel features (io_uring, landlock, etc.)
- Full terminal I/O constant definitions with architecture-specific baud rates

### Future-Proof Design
- Reserved fields in structures for ABI evolution
- Deprecation markers for obsolete interfaces while maintaining backward compatibility
- Extensible hardware capability detection frameworks

This directory serves as the critical foundation enabling Rust systems programming across the complete spectrum of 64-bit GNU/Linux platforms, providing zero-cost abstractions over platform-specific system interfaces while maintaining complete binary compatibility with C code and system libraries.