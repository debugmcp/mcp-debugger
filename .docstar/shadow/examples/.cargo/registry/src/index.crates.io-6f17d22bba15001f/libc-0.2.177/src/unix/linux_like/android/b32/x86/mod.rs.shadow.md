# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b32/x86/mod.rs
@source-hash: 52f402bc27e3ddc5
@generated: 2026-02-09T17:58:20Z

## Android x86 32-bit Platform-Specific Definitions

This file provides platform-specific type definitions, structures, constants, and syscall bindings for Android on 32-bit x86 architecture. It's part of the libc crate's hierarchical platform definitions (`unix/linux_like/android/b32/x86`).

### Key Type Definitions (L3-4)
- `wchar_t = i32`: Wide character type for x86 Android
- `greg_t = i32`: General register type for signal context

### Core Structures

**Floating Point Structures (L7-22)**
- `_libc_fpreg` (L7-10): x86 floating-point register representation with significand and exponent fields
- `_libc_fpstate` (L12-22): Complete x86 FPU state including control/status words, instruction/data pointers, and 8 FP registers

**Signal Context Structures (L24-58)**
- `mcontext_t` (L24-29): Machine context with 19 general registers, FPU state pointer, old signal mask, and CR2 register
- `__c_anonymous_uc_sigmask_with_padding` (L33-37): Signal mask wrapper with Android-specific padding due to smaller x86 sigset_t
- `__c_anonymous_uc_sigmask` (L39-42): Union providing both regular and 64-bit signal mask access
- `ucontext_t` (L44-52): Complete user context for signal handling with flags, stack info, machine context, and signal mask
- `max_align_t` (L55-57): 8-byte aligned type for maximum alignment requirements

### Trait Implementations (L60-110)
Conditional `PartialEq`, `Eq`, and `Hash` implementations for signal-related structures when `extra_traits` feature is enabled. Implementations deliberately ignore padding fields to ensure correct equality semantics.

### File Operation Constants (L112-117)
x86-specific file operation flags: `O_DIRECT`, `O_DIRECTORY`, `O_NOFOLLOW`, `O_LARGEFILE`, and memory mapping flag `MAP_32BIT`.

### Complete x86 Syscall Table (L119-535)
Comprehensive mapping of syscall names to numbers (0-450), including:
- Core system calls (exit, fork, read, write, open, etc.)
- Process management (execve, clone, wait4, etc.)
- Memory management (mmap, mprotect, brk, etc.)
- File system operations (stat, mkdir, chmod, etc.)
- Signal handling (sigaction, sigprocmask, etc.)
- Modern syscalls (io_uring, landlock, pidfd operations, etc.)

**Deprecated Syscalls**: `SYS_create_module` (L248), `SYS_get_kernel_syms` (L252), `SYS_query_module` (L296) marked as deprecated since libc 0.2.70.

### Register Offset Constants (L538-580)
- **User registers** (L538-554): EBX, ECX, EDX, etc. offsets for ptrace/debugging
- **Machine context registers** (L557-575): REG_GS, REG_FS, etc. for signal context access
- **Auxiliary vector** (L578-580): AT_SYSINFO constants for dynamic linker

### Platform-Specific Function (L585-604)
`accept4` function implementation using `socketcall` syscall workaround for Android < 5.0 where direct `accept4` syscall isn't exposed. Uses SYS_ACCEPT4 constant (L583) within socketcall framework.

### Architecture Notes
- Addresses Android x86's smaller sigset_t with explicit padding
- Provides complete x86 syscall compatibility layer
- Handles legacy Android limitations with syscall workarounds