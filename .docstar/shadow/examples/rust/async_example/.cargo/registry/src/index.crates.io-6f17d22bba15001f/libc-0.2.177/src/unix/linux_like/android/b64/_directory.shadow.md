# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b64/
@generated: 2026-02-09T18:16:41Z

## Purpose and Responsibility

This directory provides comprehensive Android 64-bit platform abstractions within the libc crate, serving as the critical bridge between Rust applications and Android's kernel/userspace on three major 64-bit architectures: ARM64 (aarch64), x86_64, and RISC-V 64-bit. It delivers complete C ABI-compatible type definitions, system call interfaces, and hardware-specific bindings that enable direct interoperability with the Android NDK and Linux kernel.

## Key Components and Integration

The module is organized as a unified platform layer with architecture-specific specializations:

### Common Foundation Layer (`mod.rs`)
- **Core Platform Types**: Provides shared Android-specific definitions (`mode_t`, `off64_t`, `socklen_t`)
- **Threading Infrastructure**: Complete POSIX threading primitives (`pthread_attr_t`, `pthread_mutex_t`, `pthread_cond_t`, etc.)
- **System Structures**: Resource management (`rlimit64`, `sysinfo`), filesystem (`statfs`, `statvfs64`), and signal handling (`sigset_t`, `sigaction`)
- **Android Compatibility Layer**: Custom implementations for older Android versions and property system integration

### Architecture-Specific Specializations
Each architecture directory (aarch64, x86_64, riscv64) provides:
- **Hardware-Specific Types**: Processor context structures, register layouts, and alignment requirements
- **System Call Mappings**: Complete syscall number definitions tailored to each architecture
- **Feature Detection**: Hardware capability flags for runtime optimization
- **Platform Constants**: Architecture-specific file operation flags and memory protection settings

## Public API Surface

### Primary Entry Points
- **File System Interface**: `stat`/`stat64` structures with 64-bit file sizes and nanosecond timestamps
- **Threading API**: Complete POSIX threading primitive definitions with Android-specific customizations
- **System Call Interface**: Architecture-mapped `SYS_*` constants for direct kernel interaction
- **Process Context**: Signal handling structures (`ucontext_t`, `mcontext_t`) and processor state management
- **Hardware Abstraction**: CPU capability detection flags and architecture-specific feature sets

### Integration Points
- **Multi-Architecture Support**: Conditional compilation selects appropriate architecture-specific definitions
- **Android System Integration**: Property system bindings, compatibility shims, and NDK interoperability
- **Kernel Interface**: Direct system call access with proper ABI compliance across all supported architectures

## Internal Organization and Data Flow

The directory follows a hierarchical organization pattern:

1. **Common Layer**: `mod.rs` provides shared Android 64-bit definitions and threading infrastructure
2. **Architecture Layer**: Specialized subdirectories handle platform-specific implementations
3. **Selection Logic**: Conditional compilation (`cfg_if!`) routes to appropriate architecture at build time

### Data Flow Pattern
1. **Application Layer**: Rust code imports types and constants from this module
2. **ABI Translation**: Structures provide zero-copy FFI compatibility with Android system libraries
3. **Kernel Interface**: System call constants enable direct kernel interaction
4. **Hardware Abstraction**: Capability flags allow runtime feature detection and optimization

## Important Patterns and Conventions

### ABI Compatibility Strategy
- **Zero-Copy FFI**: All structures match exact C ABI layouts for each target architecture
- **Padding Preservation**: Custom trait implementations handle structure padding correctly
- **Type Safety**: Rust type system prevents ABI violations while maintaining system access

### Architecture Abstraction
- **Unified Interface**: Common functionality exposed through consistent APIs across architectures
- **Hardware-Specific Extensions**: Each architecture exposes unique capabilities through specialized types
- **Feature Detection**: Runtime capability discovery through architecture-specific hardware flags

### Android Integration
- **Version Compatibility**: Includes compatibility shims for older Android versions
- **System Services**: Direct integration with Android property system and runtime services
- **NDK Compatibility**: Full binary compatibility with Android Native Development Kit

## Role in Larger System

This module serves as the foundational systems programming layer for Android 64-bit platforms in the Rust ecosystem. It enables:

- **Native Android Development**: Direct access to Android system APIs and kernel interfaces
- **Cross-Architecture Portability**: Unified abstractions that work across ARM64, x86_64, and RISC-V
- **Performance Optimization**: Hardware-specific feature detection and low-level system access
- **System Integration**: Seamless interoperability with Android framework and native libraries

The comprehensive coverage of threading, file systems, process management, and hardware abstraction makes this the essential foundation for any Rust application targeting Android 64-bit platforms, providing both safety and performance while maintaining full system access.