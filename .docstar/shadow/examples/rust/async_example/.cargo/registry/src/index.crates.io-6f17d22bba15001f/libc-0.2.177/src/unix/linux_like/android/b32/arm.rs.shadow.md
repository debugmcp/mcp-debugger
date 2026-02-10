# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b32/arm.rs
@source-hash: e68f6a15870a22e0
@generated: 2026-02-09T17:57:24Z

This is a platform-specific module for the libc crate, providing ARM 32-bit Android bindings for Linux-like systems.

## Primary Purpose
Defines type aliases, data structures, constants, and workaround functions specific to ARM 32-bit Android platforms. Part of the broader libc crate hierarchy targeting `unix/linux_like/android/b32/arm`.

## Key Type Definitions
- `wchar_t = u32` (L3): Wide character type for ARM Android
- `greg_t = i32` (L4): General register type
- `mcontext_t = sigcontext` (L5): Machine context alias

## Core Structures

### Signal Context (`sigcontext`, L8-30)
Complete ARM register state capture containing:
- Exception info: `trap_no`, `error_code`, `oldmask`
- ARM general purpose registers: `arm_r0` through `arm_r10`
- Special registers: `arm_fp`, `arm_ip`, `arm_sp`, `arm_lr`, `arm_pc`, `arm_cpsr`
- Fault address for memory exceptions

### User Context Structures (L33-57)
- `__c_anonymous_uc_sigmask_with_padding` (L34-38): Signal mask with Android-specific padding
- `__c_anonymous_uc_sigmask` (L40-43): Union for different signal mask formats
- `ucontext_t` (L45-56): Complete user context with flags, stack info, machine context, and register space

## Conditional Trait Implementations (L59-111)
Feature-gated implementations of `PartialEq`, `Eq`, and `Hash` for the above structures when `extra_traits` feature is enabled. Custom implementations ignore padding fields to ensure correct equality semantics.

## File Operation Constants (L113-116)
ARM-specific file operation flags: `O_DIRECT`, `O_DIRECTORY`, `O_NOFOLLOW`, `O_LARGEFILE`

## System Call Numbers (L118-493)
Comprehensive mapping of system call names to ARM-specific numbers, covering:
- Process management (fork, exec, exit)
- File operations (open, read, write, close)
- Memory management (mmap, mprotect, brk)
- Signal handling (sigaction, sigreturn)
- Network operations (socket, bind, connect)
- Modern syscalls (io_uring, landlock, process_madvise)

## Register Constants (L495-513)
ARM register indices (`REG_R0` through `REG_R15`) and `NGREG = 18` for context manipulation.

## Platform Constants
- `AT_SYSINFO_EHDR = 33` (L516): Auxiliary vector entry for VDSO

## Workaround Function (L518-532)
`accept4()` function implementing direct syscall invocation as workaround for Android API level < 21 where `accept4` wasn't exposed by libc. Uses `crate::syscall(SYS_accept4, ...)` directly.

## Dependencies
- Uses `crate::prelude::*` for common libc types
- References `crate::sigset_t`, `crate::stack_t` for signal handling
- Employs `s!` and `s_no_extra_traits!` macros for structure definitions
- Uses `cfg_if!` for conditional compilation
- Leverages `f!` macro for function definitions

## Architecture Notes
This module handles ARM-specific register layouts and system call numbering, with careful attention to Android's deviations from standard Linux (particularly around signal masks and padding requirements).