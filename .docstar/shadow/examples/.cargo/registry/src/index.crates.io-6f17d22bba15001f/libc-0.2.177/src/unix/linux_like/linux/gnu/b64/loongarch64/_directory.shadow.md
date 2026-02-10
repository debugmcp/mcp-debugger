# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/loongarch64/
@generated: 2026-02-09T18:16:11Z

## LoongArch64 GNU/Linux ABI Implementation

This directory provides the complete low-level system interface definitions for LoongArch64 processors running Linux with GNU C library. It serves as the foundation layer that enables Rust programs to interact with the operating system kernel and runtime libraries on this specific architecture.

### Overall Purpose

This module implements the Application Binary Interface (ABI) contract between Rust code and the LoongArch64 Linux kernel/GNU libc combination. It defines the exact memory layouts, constants, and calling conventions needed for system calls, threading, signal handling, file operations, and hardware interaction.

### Key Components

**Core System Interface**
- **Type Definitions**: Architecture-specific primitive types (`wchar_t`, `blksize_t`, etc.) that match GNU libc expectations
- **System Call Numbers**: Complete mapping of 200+ system calls from basic I/O to modern security features (landlock, futex_waitv)
- **Error Codes**: Extended POSIX error constants plus Linux/hardware-specific errors

**File System & I/O**
- **File Metadata Structures**: `stat`, `stat64`, `statfs`, `statvfs` for file and filesystem information
- **File Operations**: Constants for file opening, locking (`flock`), and POSIX advisory operations
- **Terminal Control**: Comprehensive termios constants for serial/terminal I/O

**Process & Threading**
- **Process Context**: `ucontext_t`, `mcontext_t` for signal handling and context switching
- **CPU State**: `user_regs_struct` (32 GPRs), `user_fp_struct` (32 FPRs) for debugging/profiling
- **Threading Primitives**: `pthread_attr_t` and mutex initializer constants with proper endian handling
- **Process Creation**: `clone_args` structure for advanced process/thread creation

**Signal & IPC**
- **Signal Handling**: `sigaction`, `siginfo_t`, `stack_t` structures for asynchronous event handling  
- **IPC Mechanisms**: `ipc_perm`, `shmid_ds` for System V shared memory
- **Memory Management**: MAP_* flags for mmap operations and memory locking

**Hardware Abstraction**
- **CPU Capabilities**: HWCAP constants for runtime feature detection (FPU, vector extensions, etc.)
- **Architecture Alignment**: 16-byte aligned contexts and endian-aware data layouts

### Public API Surface

The module exposes its interface through standard Rust module visibility:
- **Type Aliases**: Public type definitions matching C ABI (`pub type wchar_t = i32`)
- **Structure Definitions**: Public structs with `#[repr(C)]` layout (`pub struct stat`)  
- **Constants**: Public const values for system calls, flags, and limits (`pub const SYS_read`)

### Internal Organization

The code follows a logical hierarchy:
1. **Basic Types** → **Complex Structures** → **Constants**
2. **File System** → **Process/Thread** → **Signal/IPC** → **Hardware**
3. **Core Definitions** → **Extended Features** → **Architecture-Specific Details**

Data flows from low-level type definitions up through complex system structures, with constants providing the symbolic interface to kernel functionality.

### Integration Patterns

This module integrates with the broader libc crate through:
- **Conditional Compilation**: Platform-specific definitions selected by target triple
- **ABI Compatibility**: Exact memory layout matching for FFI safety
- **Feature Detection**: Runtime capability querying through HWCAP constants
- **Error Propagation**: Unified error code space from kernel to application

The module serves as the authoritative source for "what the kernel expects" on LoongArch64, enabling higher-level Rust code to make system calls safely and efficiently.