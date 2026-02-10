# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/x86/
@generated: 2026-02-09T18:16:11Z

## 32-bit x86 Linux GNU Platform Definitions

This directory provides the complete platform-specific type definitions, constants, and system interface for 32-bit x86 Linux systems using GNU libc (glibc). It serves as a critical component in the Rust `libc` crate's platform abstraction hierarchy, enabling safe FFI (Foreign Function Interface) with C system libraries on this specific architecture.

### Overall Purpose and Responsibility

This module layer represents the most specific platform targeting in the `libc` crate's hierarchy:
- **Architecture**: x86 (32-bit)  
- **Operating System**: Linux
- **C Library**: GNU libc (glibc)
- **Word Size**: 32-bit addressing

It provides the foundational types, structures, and constants required for Rust programs to interact with the Linux kernel and glibc on 32-bit x86 systems through system calls, file operations, signal handling, and process management.

### Key Components and Organization

**Core System Types**
- Fundamental C-compatible types (`wchar_t`, `greg_t`) sized for 32-bit x86
- File system structures (`stat64`, `statfs`/`statfs64`, `flock`/`flock64`) with proper 32/64-bit handling
- Process and signal handling types (`sigaction`, `siginfo_t`, `ucontext_t`, `mcontext_t`)

**Architecture-Specific Structures**
- x86 CPU state representation (`user_regs_struct`, `user_fpxregs_struct`) for debugging/ptrace
- Complete user process memory layout (`user` struct)
- Extended floating-point register definitions with custom trait implementations

**IPC and System Resources**
- Inter-process communication structures (`ipc_perm`, `shmid_ds`, `msqid_ds`)
- Memory management and file operation constants
- Terminal I/O definitions with comprehensive baud rate support

**System Interface Constants**
- Complete x86 Linux system call number table (462 system calls)
- Signal constants and stack size definitions  
- Error code mappings specific to Linux
- Register offset definitions for low-level access

### Public API Surface

**Primary Entry Points:**
- Type definitions for all major Linux system structures
- Constants for file operations, memory mapping, and signal handling
- System call numbers for direct kernel interface
- Register layout definitions for debugging and context switching

**External Functions:**
- Context manipulation functions: `getcontext`, `setcontext`, `makecontext`, `swapcontext`

### Internal Organization and Data Flow

The module follows a logical organization pattern:
1. **Basic Types** → Platform-specific primitive types
2. **Core Structures** → System data structures with proper alignment
3. **Constants** → Categorized by functional area (files, signals, terminals, etc.)
4. **System Call Table** → Complete kernel interface mapping
5. **Register Definitions** → Low-level hardware access patterns

### Important Patterns and Conventions

**Conditional Compilation**: Extensive use of feature flags (`gnu_time_bits64`, `gnu_file_offset_bits64`, `extra_traits`) to handle different glibc configurations and optional functionality.

**32/64-bit Compatibility**: Dual structure definitions (e.g., `statfs`/`statfs64`, `flock`/`flock64`) to support both traditional 32-bit and large file operations on 32-bit systems.

**C ABI Compliance**: All structures use `#[repr(C)]` to ensure exact memory layout compatibility with C libraries, critical for FFI safety.

**Deprecation Handling**: Proper marking of deprecated system calls and fields while maintaining backward compatibility.

This directory represents the terminal node in the platform-specific hierarchy, providing the most precise and architecture-aware definitions needed for system-level programming on 32-bit x86 Linux with GNU libc.