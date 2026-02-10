# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b64/aarch64/mod.rs
@source-hash: 6d4fcf287ee09d65
@generated: 2026-02-09T17:57:05Z

## Purpose
Platform-specific definitions for 64-bit ARM Android (aarch64) in the libc crate, providing C ABI compatibility layer for system programming on Android ARM64 devices.

## Key Type Definitions

### Core Types (L1-6)
- `wchar_t = u32` (L4): Wide character type for Android ARM64
- `__u64 = c_ulonglong`, `__s64 = c_longlong` (L5-6): 64-bit integer types matching kernel definitions

### File System Structures (L8-54)
- `stat` (L9-30): Standard file metadata structure with 64-bit offsets, nanosecond timestamps, padding fields for ABI alignment
- `stat64` (L32-53): Identical to `stat` on 64-bit systems, maintains source compatibility

### CPU Context Structures (L55-84)
- `user_regs_struct` (L55-60): ARM64 general-purpose registers for ptrace/debugging
  - 31 general-purpose registers, stack pointer, program counter, processor state
- `ucontext_t` (L62-68): Signal context containing stack, signal mask, machine context
- `mcontext_t` (L71-78): Machine-specific context with 16-byte alignment, fault address, CPU registers, reserved space (512 x u64)
- `user_fpsimd_struct` (L80-84): Floating-point/SIMD state (32 vector registers, status registers)

### Memory Alignment (L87-92)
- `max_align_t` (L89-91): 16-byte aligned type for maximum alignment requirements on ARM64

## File Operation Constants (L94-97)
ARM64-specific file operation flags:
- `O_DIRECT = 0x10000`: Direct I/O bypass page cache
- `O_DIRECTORY = 0x4000`: Ensure path is directory
- `O_NOFOLLOW = 0x8000`: Don't follow symbolic links
- `O_LARGEFILE = 0o400000`: Enable large file support

## Signal Stack Constants (L99-100)
- `SIGSTKSZ = 16384`: Signal stack size (16KB)
- `MINSIGSTKSZ = 5120`: Minimum signal stack size (5KB)

## Hardware Capabilities (L103-168)
Comprehensive ARM64 feature detection flags:
- **HWCAP flags** (L103-134): CPU features like FP, ASIMD, AES, SHA, SVE
- **HWCAP2 flags** (L135-168): Extended features including SME, MTE, BTI, pointer authentication

## System Call Numbers (L170-466)
Complete ARM64 system call table mapping symbolic names to numbers:
- I/O operations (L170-174): io_setup, io_destroy, etc.
- File operations (L175-243): xattr, file manipulation, pipe operations
- Process/signal management (L256-302): exit, signals, scheduling
- Network operations (L361-375): socket, bind, connect, etc.
- Memory management (L377-401): mmap, mprotect, memory policy
- Modern syscalls (L439-466): pidfd, io_uring, landlock, futex_waitv

## Memory Protection Extensions (L468-469)
ARM64-specific memory protection flags:
- `PROT_BTI = 0x10`: Branch Target Identification
- `PROT_MTE = 0x20`: Memory Tagging Extension

## Auxiliary Vector (L472-473)
- `AT_SYSINFO_EHDR = 33`: vDSO location
- `AT_VECTOR_SIZE_ARCH = 2`: Architecture-specific auxiliary vector size

## Dependencies
- Imports `off64_t` and `prelude::*` from parent modules
- Uses `s!` and `s_no_extra_traits!` macros for structure definitions
- Relies on C type aliases (`c_int`, `c_long`, etc.) from crate root

## Architecture Notes
- Designed for 64-bit ARM (AArch64) Android systems
- Structures include padding fields for proper ABI alignment
- Hardware capability flags reflect modern ARM64 features (SVE, SME, security extensions)
- System call numbers follow ARM64 Linux convention
- Memory alignment requirements reflect ARM64 architecture (16-byte for some contexts)