# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/
@generated: 2026-02-09T18:16:45Z

## Overall Purpose and Responsibility

This directory provides the complete 64-bit architecture abstraction layer for GNU/Linux systems within the Rust libc crate. It serves as the critical interface between Rust applications and the Linux kernel across multiple 64-bit processor architectures, enabling type-safe system programming while maintaining strict C ABI compatibility. The module acts as the lowest-level platform-specific layer that translates Rust's type system into kernel-compatible data structures and system call interfaces.

## Key Components and Integration

### Architecture Module Hub (`mod.rs`)
The primary module serves as the central coordinator that:
- Defines common 64-bit type aliases and data structures shared across architectures
- Provides conditional compilation logic to select appropriate architecture-specific implementations
- Implements core system structures (sigset_t, sysinfo, msqid_ds, semid_ds, timex) with architecture-aware field sizing
- Establishes the foundation for pthread synchronization constants and file operation flags

### Architecture-Specific Implementations
Eight dedicated architecture modules provide complete platform bindings:
- **x86_64**: Intel/AMD 64-bit with x32 ABI variant support
- **aarch64**: ARM 64-bit with ILP32/LP64 data model flexibility
- **powerpc64**: IBM POWER architecture with endian-aware implementations
- **s390x**: IBM z/Architecture mainframe systems
- **riscv64**: RISC-V 64-bit with comprehensive floating-point extension support
- **mips64**: MIPS 64-bit with platform-specific syscall numbering
- **sparc64**: SPARC 64-bit with unique memory model requirements
- **loongarch64**: LoongArch 64-bit with modern processor capabilities

Each architecture module provides:
- Complete system call number mappings with architecture-specific offsets
- Platform-specific data structure layouts and padding requirements
- Hardware capability flags and processor feature detection constants
- Endianness-aware pthread synchronization primitive initializers

## Public API Surface

### Primary Entry Points
**Type System Foundation**:
- Architecture-specific primitive types (`wchar_t`, `nlink_t`, `blksize_t`, `ino_t`)
- 64-bit optimized types (`off_t`, `blkcnt_t`, `rlim_t`) leveraging native addressing
- Time representation types with conditional sizing based on pointer width

**System Interface Structures**:
- File system operations: `stat`/`stat64`, `statfs`/`statfs64`, `flock`/`flock64` families
- Process/thread management: `pthread_attr_t`, `sigaction`, `mcontext_t`, `ucontext_t`
- Inter-process communication: `ipc_perm`, `shmid_ds`, `msqid_ds`, `semid_ds`
- Signal handling: `siginfo_t`, `stack_t` with architecture-specific layouts

**Constants and Interfaces**:
- Complete system call number mappings (`SYS_*` constants) for all architectures
- Hardware capability detection (`HWCAP_*` flags) for processor feature queries
- File operation flags (`O_*`), memory mapping flags (`MAP_*`), and signal constants
- Pthread synchronization object sizes and static initializers

### Architecture Selection Mechanism
The module uses conditional compilation to automatically select the appropriate architecture implementation based on target configuration, providing a unified interface while leveraging platform-specific optimizations.

## Internal Organization and Data Flow

### Hierarchical Structure
```
b64/
├── mod.rs (shared 64-bit definitions + architecture dispatch)
├── x86_64/ (Intel/AMD with x32 variant)
├── aarch64/ (ARM with ILP32/LP64 models)
├── powerpc64/ (IBM POWER)
├── s390x/ (IBM z/Architecture)
├── riscv64/ (RISC-V)
├── mips64/ (MIPS)
├── sparc64/ (SPARC)
└── loongarch64/ (LoongArch)
```

### Data Flow Pattern
1. **Common Layer**: `mod.rs` provides shared 64-bit type definitions and structures
2. **Architecture Dispatch**: Conditional compilation selects appropriate platform module
3. **Platform Specialization**: Architecture-specific modules provide detailed implementations
4. **ABI Compliance**: All definitions maintain strict compatibility with GNU C library
5. **System Interface**: Enables direct kernel interaction through properly formatted system calls

## Important Patterns and Conventions

### Cross-Architecture Consistency
- Unified approach to endianness handling across all platforms
- Consistent structure definition patterns using `s!` and `s_no_extra_traits!` macros
- Standardized conditional compilation for feature detection and ABI variants

### 64-bit Optimization
- Native 64-bit addressing throughout all architectures
- Optimized field layouts taking advantage of 64-bit alignment requirements
- Large file support (LFS) integration with `O_LARGEFILE` flag management

### Hardware Abstraction
- Comprehensive CPU feature detection for modern processor capabilities
- Architecture-specific register layouts for debugging and signal contexts
- Platform-specific memory protection and security feature support

This directory represents the complete foundation for 64-bit GNU/Linux system programming in Rust, enabling portable yet optimized code across diverse processor architectures while maintaining memory safety and type correctness.