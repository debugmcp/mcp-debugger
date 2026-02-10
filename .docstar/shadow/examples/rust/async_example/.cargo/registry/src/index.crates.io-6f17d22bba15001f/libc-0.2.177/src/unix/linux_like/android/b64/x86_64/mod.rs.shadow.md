# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b64/x86_64/mod.rs
@source-hash: 7243327f35f4f4e5
@generated: 2026-02-09T17:57:12Z

## Purpose
Platform-specific type and constant definitions for Android x86_64 (64-bit) architecture in the libc crate. This module provides low-level C interoperability bindings for system structures, register layouts, and syscall numbers specific to the Linux-like Android environment on x86_64 processors.

## Key Type Definitions

### Basic Types (L4-7)
- `wchar_t`: 32-bit signed integer for wide character representation
- `greg_t`: 64-bit signed integer for general register values
- `__u64`/`__s64`: Unsigned/signed 64-bit types aliasing C long long

### File System Structures (L9-48)
- `stat` (L10-28): Standard file status structure with 64-bit file size (`off64_t`)
- `stat64` (L30-48): Identical to `stat` - both use 64-bit sizes on this platform
- Both contain standard Unix stat fields: device, inode, mode, ownership, timestamps with nanosecond precision

### Processor Context Structures (L50-106)
- `_libc_xmmreg` (L50-52): XMM register representation (4 x 32-bit elements)
- `user_regs_struct` (L54-82): Complete x86_64 register set including general-purpose (rax-rdi), segment (cs, ds, etc.), and special registers (rip, rsp, eflags)
- `user` (L84-106): Process debugging structure containing registers, floating-point state, and memory layout information

### Signal and Context Handling (L109-185)
- `__c_anonymous_uc_sigmask` (L110-113): Union for different signal mask formats
- `max_align_t` (L116-118): 16-byte aligned type for maximum alignment requirements
- `_libc_fpxreg` (L138-142): Extended floating-point register format
- `_libc_fpstate` (L144-156): Complete x87/SSE floating-point processor state
- `mcontext_t` (L158-162): Machine context with general registers and FPU state pointer
- `ucontext_t` (L164-171): Complete execution context for signal handling
- `user_fpregs_struct` (L173-185): User-space floating-point register structure

## Conditional Trait Implementations (L121-311)
Custom `PartialEq`, `Eq`, and `Hash` implementations for structures containing padding fields, enabled by the "extra_traits" feature. These implementations correctly ignore padding while comparing/hashing meaningful fields.

## File System Constants (L314-323)
Standard Linux file operation flags:
- `O_DIRECT`, `O_DIRECTORY`, `O_NOFOLLOW`, `O_LARGEFILE`: File opening behavior flags
- `SIGSTKSZ`, `MINSIGSTKSZ`: Signal stack size constants
- `MAP_32BIT`: Memory mapping constraint for 32-bit address space

## System Call Table (L326-690)
Comprehensive x86_64 Linux syscall number definitions (SYS_*), covering:
- File operations (read, write, open, stat, etc.)
- Process management (fork, exec, exit, etc.)
- Memory management (mmap, brk, etc.)
- Signal handling (rt_sig* family)
- Network operations (socket, bind, listen, etc.)
- Advanced features (epoll, timerfd, io_uring, etc.)

## Register Offset Constants (L692-747)
Two sets of register indexing constants:
- `user_regs_struct` offsets (L693-719): For ptrace debugging access
- `mcontext_t.gregs` offsets (L722-744): For signal context access

## Architecture-Specific Constants (L747-748)
- `AT_SYSINFO_EHDR`, `AT_VECTOR_SIZE_ARCH`: ELF auxiliary vector definitions

## Dependencies
- `crate::off64_t`: 64-bit file offset type
- `crate::prelude::*`: Common C types (c_int, c_long, etc.)
- Various crate-internal types (dev_t, ino_t, uid_t, etc.)

## Architecture Notes
This module is specifically for x86_64 Android, providing the exact memory layouts and constants that match the Android NDK and Linux kernel interfaces on 64-bit x86 processors. The structures match C ABI requirements for direct FFI usage.