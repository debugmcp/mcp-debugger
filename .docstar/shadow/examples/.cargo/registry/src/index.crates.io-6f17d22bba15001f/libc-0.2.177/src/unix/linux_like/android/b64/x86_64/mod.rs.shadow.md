# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b64/x86_64/mod.rs
@source-hash: 7243327f35f4f4e5
@generated: 2026-02-09T17:58:20Z

## Purpose
Platform-specific C FFI bindings for Android x86_64 architecture. Provides native type definitions, system call constants, and low-level structures required for interfacing with the Linux kernel and Android runtime on 64-bit x86 platforms.

## Key Type Definitions

### Basic Types (L4-7)
- `wchar_t = i32`: Wide character type for Android x86_64
- `greg_t = i64`: General register type for signal contexts
- `__u64 = c_ulonglong`, `__s64 = c_longlong`: Kernel-specific 64-bit types

### File System Structures (L10-48)
- `stat` (L10-28): Standard file metadata structure with nanosecond timestamp precision
- `stat64` (L30-48): 64-bit file stat structure (identical to `stat` on this platform)
- Both use `off64_t` for file sizes, supporting large files

### CPU Context Structures (L50-106)
- `_libc_xmmreg` (L50-52): XMM register representation (4x u32 elements)
- `user_regs_struct` (L54-82): Complete x86_64 register set for debugging/tracing
  - Contains all general-purpose registers (rax, rbx, etc.)
  - Includes segment registers and instruction pointer
- `user` (L84-106): Process debugging structure containing registers and memory layout info

### Signal/Context Handling (L110-185)
- `__c_anonymous_uc_sigmask` (L110-113): Union for signal mask compatibility
- `max_align_t` (L116-118): 16-byte aligned type for memory alignment
- `_libc_fpstate` (L144-156): x87 FPU and SSE state preservation
- `mcontext_t` (L158-162): Machine context for signal handlers
- `ucontext_t` (L164-171): Complete user context including stack and signals
- `user_fpregs_struct` (L173-185): Floating-point register state for debugging

## Architecture Dependencies
- Uses conditional compilation for 32-bit compatibility fields (L95-99)
- Implements x86_64-specific register layouts and calling conventions
- Provides both legacy x87 and modern SSE/XMM register support

## System Call Interface (L326-690)
Complete x86_64 Linux system call table with sequential numbering:
- Basic I/O: `SYS_read` (0) through file operations
- Process management: `SYS_fork`, `SYS_execve`, etc.
- Modern additions: `SYS_io_uring_*`, `SYS_landlock_*`, etc.
- Range: 0-450 covering all major kernel subsystems

## Register Constants (L693-748)
Two distinct register indexing schemes:
- `user_regs_struct` offsets (L693-719): For ptrace/debugging access
- `mcontext_t.gregs` offsets (L722-744): For signal handler contexts
- Different ordering reflects architectural vs. ABI requirements

## Platform Constants (L314-323, L747-748)
- File operation flags: `O_DIRECT`, `O_DIRECTORY`, etc.
- Signal stack sizes: `SIGSTKSZ` (8192), `MINSIGSTKSZ` (2048)  
- Memory mapping: `MAP_32BIT` for address space control
- Auxiliary vector: `AT_SYSINFO_EHDR`, `AT_VECTOR_SIZE_ARCH`

## Design Patterns
- Uses `s!` macro for structures with standard traits
- Uses `s_no_extra_traits!` for complex structures requiring custom trait implementations
- Conditional trait implementations via `cfg_if!` based on "extra_traits" feature
- Explicit padding field exclusion in equality/hash implementations