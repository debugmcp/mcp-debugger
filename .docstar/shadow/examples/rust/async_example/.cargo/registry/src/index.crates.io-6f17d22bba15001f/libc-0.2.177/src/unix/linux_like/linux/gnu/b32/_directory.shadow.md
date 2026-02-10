# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/
@generated: 2026-02-09T18:16:45Z

## 32-bit GNU Linux Architecture Abstraction Layer

This directory provides the complete platform-specific abstraction layer for 32-bit GNU Linux systems within the Rust `libc` crate. It serves as the critical bridge between Rust applications and the underlying Linux kernel/GNU libc interfaces across multiple 32-bit architectures, handling the complex variations in ABI, system call numbers, data structure layouts, and feature capabilities.

## Overall Purpose and Responsibility

The module implements a comprehensive multi-architecture support system for 32-bit GNU Linux platforms, providing:
- **Architecture-Agnostic Interface**: Common type definitions and structures that work across all supported 32-bit architectures
- **Feature Flag Management**: Sophisticated handling of GNU libc feature transitions (64-bit time support, large file operations)
- **Architecture-Specific Specialization**: Detailed per-architecture implementations for x86, ARM, MIPS, PowerPC, SPARC, RISC-V 32, M68K, and C-Sky
- **System Interface Compatibility**: Complete system call mappings, signal handling, and IPC mechanisms for each platform

## Key Components and Integration

### Common Foundation Layer (`mod.rs`)
Provides the shared infrastructure used by all architectures:
- **Type System**: Fundamental C-compatible types with feature-conditional sizing (time_t, off_t, ino_t)
- **Core Structures**: Common system structures (stat, statvfs, sysinfo, pthread types) with complex conditional compilation
- **Feature Coordination**: Central handling of `gnu_time_bits64` and `gnu_file_offset_bits64` transitions
- **Architecture Dispatcher**: Conditional module loading for specific 32-bit architectures

### Architecture-Specific Implementations
Each architecture directory provides complete platform specialization:
- **x86**: Traditional PC architecture with extensive backward compatibility
- **ARM**: Mobile/embedded ARM32 with register context and alignment handling  
- **MIPS**: MIPS32 with endianness considerations and offset-based syscall numbering
- **PowerPC**: PowerPC32 with architecture-specific syscalls and endian-aware constants
- **SPARC**: SPARC32 with unique signal numbers and memory alignment requirements
- **RISC-V 32**: Modern RISC-V with floating-point extension support
- **M68K**: Legacy Motorola 68000 with atomic operation support
- **C-Sky**: C-Sky processor architecture with comprehensive syscall coverage

### Cross-Cutting Concerns
All architectures provide consistent interfaces for:
- **System Call Interface**: Complete syscall number mappings (400-500+ per architecture)
- **Signal Handling**: Platform-specific signal numbers, stack sizes, and context structures
- **File System Operations**: stat/stat64 structures, file flags, and large file support
- **IPC Mechanisms**: Shared memory, message queues, and permission structures
- **Terminal Control**: Comprehensive termios support with baud rates and control flags

## Public API Surface

### Primary Entry Points
- **Type Definitions**: Platform-agnostic and architecture-specific types for FFI boundaries
- **System Structures**: Complete Linux kernel interface structures (stat, sigaction, flock, etc.)
- **Constants**: Comprehensive flag and constant definitions for all system operations
- **System Call Numbers**: Direct kernel interface via SYS_* constants for each architecture

### Integration Patterns
The API follows the libc crate's hierarchical pattern:
```
crate::unix::linux_like::linux::gnu::b32::{mod, arch-specific}
```

Higher-level libc functions consume these definitions while maintaining architecture independence through the common interface layer.

## Architecture Coordination and Data Flow

### Feature Flag Management
The system uses sophisticated conditional compilation to handle GNU libc evolution:
- **Time Transition**: `gnu_time_bits64` enables 64-bit time_t while maintaining ABI compatibility
- **Large Files**: `gnu_file_offset_bits64` provides large file support on 32-bit systems
- **Architecture Exceptions**: Specific architectures (RISC-V 32) have different baseline assumptions

### Common Interface Strategy
The `mod.rs` provides architecture-independent definitions that:
1. Define shared structures with conditional field layouts
2. Handle feature flag combinations across architectures
3. Provide fallback implementations and default constants
4. Coordinate architecture-specific module loading

### Specialization Pattern
Each architecture directory overrides or extends the common definitions with:
- Architecture-specific type sizes and alignments
- Platform-unique constants and system call numbers
- Specialized structures (register contexts, signal handling)
- Hardware-specific features and limitations

## Critical Design Patterns

- **Binary Compatibility**: All structures maintain exact C ABI compatibility across architecture variants
- **Feature Evolution**: Supports GNU libc transitions while maintaining backward compatibility
- **Zero-Cost Abstraction**: Provides safe Rust interfaces without runtime overhead
- **Comprehensive Coverage**: Complete system programming interface for each supported architecture

This directory serves as the foundational layer enabling portable system programming across the diverse landscape of 32-bit GNU Linux platforms, abstracting architecture differences while providing access to platform-specific capabilities when needed.