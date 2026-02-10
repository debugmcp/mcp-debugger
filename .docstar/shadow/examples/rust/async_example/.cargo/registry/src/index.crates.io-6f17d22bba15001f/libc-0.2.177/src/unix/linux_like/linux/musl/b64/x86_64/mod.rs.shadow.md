# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/x86_64/mod.rs
@source-hash: 95b8adc3443988aa
@generated: 2026-02-09T17:57:05Z

## Primary Purpose
Platform-specific type definitions and system call constants for x86_64 musl libc on Linux. This module provides low-level FFI bindings that match the C ABI for the musl libc implementation on 64-bit x86 architecture.

## Key Type Definitions

**Basic Types (L4-9)**: Platform-specific type aliases including `wchar_t` as `i32`, `nlink_t` as `u64`, and register types `greg_t` as `i64`.

**File System Structures**:
- `stat` (L12-31): Standard file metadata structure with device, inode, permissions, timestamps, and size information
- `stat64` (L33-52): 64-bit version using `ino64_t` and `blkcnt64_t` for large file support

**Process Debug Structures**:
- `user_regs_struct` (L54-82): Complete x86_64 register set for ptrace operations, including all general-purpose registers (rax, rbx, etc.), instruction pointer, and segment registers
- `user` (L84-104): Process debugging structure containing register state, floating-point info, and memory layout details
- `user_fpregs_struct` (L151-163): x86_64 floating-point register state with SSE/MMX support

**Signal Handling**:
- `mcontext_t` (L109-112): Machine context with 23 general registers array, sourced from musl commit b4b1e10364c
- `ucontext_t` (L165-172): User context for signal handling with stack info and signal mask

**IPC Structure**:
- `ipc_perm` (L114-132): Inter-process communication permissions with conditional field naming based on musl version

**Process Management**:
- `clone_args` (L134-147): Modern clone3() syscall arguments structure with 8-byte alignment

## System Call Constants (L251-617)
Complete x86_64 Linux syscall table from `SYS_read` (0) to `SYS_mseal` (462), including modern syscalls like io_uring, landlock, and process management calls.

## Register Offset Constants
- User register offsets (L620-646): Indices for ptrace register access
- Signal context register offsets (L652-674): Positions in mcontext_t.gregs array

## Platform Constants (L676-915)
Architecture-specific values for file operations, memory mapping, signals, terminal I/O, and error codes, all tailored for x86_64 Linux with musl libc.

## Dependencies
- `crate::off_t` and `crate::prelude::*` (L1-2)
- Uses `s!` and `s_no_extra_traits!` macros for structure definitions
- Conditional trait implementations based on "extra_traits" feature (L180-247)

## Notable Patterns
- Extensive use of conditional compilation for musl version compatibility
- Private padding fields for ABI alignment
- Manual trait implementations that exclude padding fields from comparison/hashing
- Reference to specific musl git commit for structure definitions ensuring ABI stability