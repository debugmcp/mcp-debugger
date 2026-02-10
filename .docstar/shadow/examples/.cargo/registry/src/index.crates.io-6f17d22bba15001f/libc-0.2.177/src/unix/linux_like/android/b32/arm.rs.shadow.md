# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b32/arm.rs
@source-hash: e68f6a15870a22e0
@generated: 2026-02-09T18:02:19Z

## Purpose
ARM 32-bit Android platform-specific bindings for the libc crate. Provides type definitions, system call numbers, and platform constants for ARM-based Android systems (32-bit).

## Key Types and Structures

### Type Aliases (L3-5)
- `wchar_t = u32`: Wide character type for ARM Android
- `greg_t = i32`: General register type  
- `mcontext_t = sigcontext`: Machine context type alias

### Signal Context Structure (L8-30)
`sigcontext` - ARM processor context for signal handling, containing:
- Exception info: `trap_no`, `error_code`, `oldmask`
- ARM registers R0-R12: `arm_r0` through `arm_r10`
- Special registers: `arm_fp` (frame pointer), `arm_ip` (instruction pointer), `arm_sp` (stack pointer), `arm_lr` (link register), `arm_pc` (program counter)
- Status: `arm_cpsr` (current program status register), `fault_address`

### Signal Mask Structures (L34-56)
- `__c_anonymous_uc_sigmask_with_padding` (L34-38): Signal mask with Android x86 compatibility padding
- `__c_anonymous_uc_sigmask` (L40-43): Union of regular and 64-bit signal masks
- `ucontext_t` (L45-56): Complete user context for signal handling with ARM-specific padding and register space

## Trait Implementations (L60-111)
Conditional trait implementations under `extra_traits` feature:
- `PartialEq`, `Eq`, `Hash` for all signal mask and context types
- Implementations ignore padding fields to avoid spurious inequality

## File Operation Constants (L113-116)
ARM-specific values for file operations:
- `O_DIRECT`, `O_DIRECTORY`, `O_NOFOLLOW`, `O_LARGEFILE`

## System Call Numbers (L118-493)
Comprehensive ARM Linux syscall number definitions from 0-450, including:
- Basic syscalls: `SYS_exit`, `SYS_read`, `SYS_write`
- Modern syscalls: `SYS_io_uring_*`, `SYS_landlock_*`, `SYS_futex_waitv`
- ARM-specific: `SYS_arm_fadvise64_64` (L340), `SYS_arm_sync_file_range` (L411)

## Register Constants (L496-513)
ARM register indices for `mcontext_t.gregs`:
- `REG_R0` through `REG_R15` (ARM registers R0-R15)
- `NGREG = 18`: Total number of general registers

## Platform Constants (L516)
- `AT_SYSINFO_EHDR = 33`: Auxiliary vector entry for system info

## Special Functions (L524-531)
`accept4()` - Workaround implementation using direct syscall for Android < 5.0 (API 21) compatibility, as the libc doesn't expose this syscall on older versions.

## Dependencies
- Uses `crate::prelude::*` for common types
- References `crate::sigset_t`, `crate::sigset64_t`, `crate::stack_t` for signal handling
- Relies on `cfg_if!` macro for conditional compilation