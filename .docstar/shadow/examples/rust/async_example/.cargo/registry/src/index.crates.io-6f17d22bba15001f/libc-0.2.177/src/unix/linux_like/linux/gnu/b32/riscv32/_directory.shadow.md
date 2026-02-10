# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/riscv32/
@generated: 2026-02-09T18:16:10Z

**RISC-V 32-bit Linux GNU ABI Module**

This directory provides comprehensive C FFI definitions for RISC-V 32-bit systems running Linux with GNU toolchain, serving as a critical platform-specific layer within the libc crate's Unix compatibility hierarchy.

## Overall Purpose and Responsibility

This module implements the complete ABI interface between Rust and the Linux kernel on RISC-V 32-bit architecture, including:
- System call definitions and numbers
- C-compatible data structures for kernel interfaces
- Signal handling and context switching mechanisms
- File system and IPC primitives
- Architecture-specific register layouts

## Key Components and Organization

### Core System Structures
The module defines essential kernel interface structures using libc's `s!` macro for C compatibility:
- **File System Interface**: `stat64`, `statfs64`, `flock64` for 64-bit file operations
- **IPC Mechanisms**: `msqid_ds`, `shmid_ds`, `ipc_perm` for inter-process communication
- **Signal Infrastructure**: `sigaction`, `siginfo_t`, `stack_t` for signal handling
- **Process Context**: `user_regs_struct` defining RISC-V's 32 general-purpose registers

### Architecture-Specific Context Management
Specialized structures handle RISC-V execution context:
- **`ucontext_t`**: Complete user context for signal handlers
- **`mcontext_t`**: Machine-specific register state with alignment requirements
- **Floating-Point Extensions**: Support for F/D/Q extensions (`__riscv_mc_*_ext_state`)

### System Call Interface
Complete mapping of Linux system calls to RISC-V 32-bit numbers (506+ syscalls), covering:
- Traditional POSIX operations (I/O, process control, memory management)
- Modern Linux features (io_uring, landlock, pidfd operations)
- Architecture-specific call conventions

## Public API Surface

### Primary Entry Points
- **Type Definitions**: Platform-specific `wchar_t` and system structures
- **Constants**: File flags, error codes, signal numbers, terminal control
- **Register Access**: `NGREG`, `REG_*` constants for debugging/ptrace
- **System Calls**: `SYS_*` constants for direct kernel interface

### Integration Points
- Imports core libc types via `crate::prelude::*`
- Provides 64-bit file offset support through `off64_t`/`off_t`
- Exposes RISC-V register layout for debugging tools

## Internal Organization and Data Flow

The module follows a hierarchical organization:
1. **Type Layer**: Basic type mappings (`wchar_t`)
2. **Structure Layer**: Kernel interface structures with proper alignment
3. **Constants Layer**: Platform-specific values and flags
4. **System Call Layer**: Direct kernel interface mapping

Data flow centers on providing zero-cost abstractions for kernel interfaces while maintaining strict ABI compatibility with C and the Linux kernel.

## Important Patterns and Conventions

- **Alignment Safety**: Critical structures use explicit alignment directives
- **ABI Compatibility**: All structures match Linux kernel expectations exactly
- **Extension Support**: Floating-point structures accommodate different RISC-V extensions
- **No Extra Traits**: Context structures use `s_no_extra_traits!` to prevent unsafe derive operations
- **Complete Coverage**: Comprehensive syscall mapping ensures full Linux functionality

This module serves as the foundation for all system-level operations on RISC-V 32-bit Linux systems, enabling safe and efficient interaction between Rust applications and the underlying operating system kernel.