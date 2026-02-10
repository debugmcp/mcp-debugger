# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/mips64/
@generated: 2026-02-09T18:16:12Z

## Purpose
This directory provides comprehensive MIPS64 GNU/Linux architecture-specific definitions for the libc crate. It serves as the lowest-level platform abstraction layer, enabling Rust programs to interface with the Linux kernel and standard C library on MIPS64 systems. The module bridges Rust's type system with the specific ABI requirements, data structure layouts, and system call conventions used by MIPS64 GNU/Linux.

## Key Components

### Type System Foundation
- **Basic Types**: Platform-specific definitions for fundamental types (`blksize_t`, `nlink_t`, `wchar_t`, etc.)
- **Raw Types**: Direct kernel interface types (`__u64`, `__s64`) for low-level operations
- **Alignment Types**: `max_align_t` ensuring proper memory alignment for MIPS64 architecture

### System Interface Structures
- **File System**: Complete stat/statfs family providing file metadata and filesystem information
- **IPC Primitives**: Shared memory descriptors and permission structures with MIPS64-specific field ordering
- **Threading**: pthread attributes and synchronization primitives with endian-aware configurations
- **Signal Handling**: Signal action descriptors and stack management with proper padding

### System Call Interface
- **Comprehensive Mapping**: All Linux system calls mapped to MIPS64-specific numbers (base offset 5000)
- **Modern Support**: Includes contemporary kernel features (io_uring, landlock, etc.)
- **Legacy Compatibility**: Maintains deprecated syscalls with appropriate deprecation markers

### Platform Constants
- **Error Codes**: Complete errno mapping with MIPS64-specific values
- **File Operations**: Open flags, descriptor flags, and terminal control constants
- **Memory Management**: Mapping flags and process control constants
- **Terminal I/O**: Extensive baud rate and control flag definitions

## Public API Surface

### Main Entry Points
- **mod.rs**: Primary module exposing all MIPS64 GNU/Linux definitions
- **Type Definitions**: Platform-specific versions of POSIX types
- **Constants**: Architecture-specific values for system calls and operations
- **Structure Layouts**: Kernel-compatible data structure definitions

### Critical Interfaces
- System call number mappings for kernel interface
- pthread synchronization primitive sizes and initializers
- File system and IPC structure definitions
- Signal handling and threading support structures

## Internal Organization

### Architecture Specialization
- Endian-specific handling (little-endian vs big-endian mutex initializers)
- MIPS64-specific padding and field ordering in structures
- Platform-appropriate constant values using octal notation for compatibility

### Data Flow Pattern
1. Rust code uses high-level libc functions
2. Functions reference these platform-specific type definitions
3. Structures map directly to kernel ABI expectations
4. System calls use MIPS64-specific numbering scheme
5. Error handling uses platform-specific errno values

## Important Conventions

### ABI Compliance
- All structures maintain exact kernel-expected layouts with appropriate padding
- Field ordering follows MIPS64 GNU/Linux conventions
- Size definitions ensure proper memory allocation for synchronization primitives

### Endian Handling
- Separate initializer constants for little and big-endian configurations
- Runtime-neutral definitions allowing compile-time endian selection
- Consistent approach across all endian-sensitive structures

This module forms the foundation layer that makes cross-platform Rust code possible on MIPS64 GNU/Linux systems, providing the essential platform-specific definitions needed for system-level programming while maintaining type safety and Rust's memory safety guarantees.