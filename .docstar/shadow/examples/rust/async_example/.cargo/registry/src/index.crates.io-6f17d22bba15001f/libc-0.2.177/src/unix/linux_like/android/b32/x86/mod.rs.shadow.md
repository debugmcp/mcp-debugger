# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b32/x86/mod.rs
@source-hash: 52f402bc27e3ddc5
@generated: 2026-02-09T17:57:06Z

## Android x86 32-bit Platform-Specific Types and Constants

This module provides low-level platform bindings for Android x86 (32-bit) architecture, defining C-compatible types, structures, and system call constants used by the libc crate.

### Core Types
- `wchar_t` (L3): 32-bit wide character type (`i32`)
- `greg_t` (L4): General register type (`i32`)

### Floating Point Structures
- `_libc_fpreg` (L7-10): x87 floating-point register structure with significand array and exponent
- `_libc_fpstate` (L12-22): Complete x87 FPU state including control/status words, registers array, and status

### Context Structures
- `mcontext_t` (L24-29): Machine context containing general registers array, FPU state pointer, signal mask, and CR2 register
- `__c_anonymous_uc_sigmask_with_padding` (L33-37): Signal mask structure with Android-specific padding workaround
- `__c_anonymous_uc_sigmask` (L39-42): Union providing both regular and 64-bit signal masks
- `ucontext_t` (L44-52): Complete user context for signal handling with flags, stack, machine context, and signal masks
- `max_align_t` (L54-58): 8-byte aligned structure for maximum alignment requirements

### Trait Implementations
Conditional trait implementations (L61-110) for `PartialEq`, `Eq`, and `Hash` when "extra_traits" feature is enabled, with special handling to ignore padding fields in comparisons.

### File System Constants
- File operation flags (L112-115): `O_DIRECT`, `O_DIRECTORY`, `O_NOFOLLOW`, `O_LARGEFILE`
- Memory mapping flag (L117): `MAP_32BIT` for x86-specific 32-bit address space mapping

### System Call Table
Comprehensive x86 system call number definitions (L120-535) covering:
- Process management: fork, exec, exit, wait family
- File operations: open, read, write, stat family  
- Memory management: mmap, mprotect, brk
- Signal handling: signal, sigaction, sigprocmask
- Modern syscalls: io_uring, pidfd, landlock, futex variants
- Deprecated syscalls with version annotations (L247-248, L251-252, L295-296)

### Register Offset Constants
- User register offsets (L538-554): EBX, ECX, EDX, etc. for ptrace/debugging
- Machine context register offsets (L557-575): REG_GS, REG_FS, etc. for signal context access

### Auxiliary Vector Constants
ELF auxiliary vector entries (L578-580) for dynamic linker information.

### Custom System Call Implementation
- `accept4` function (L593-603): Workaround implementation using `socketcall` syscall for Android versions prior to API 21, with detailed architecture-specific argument marshaling

### Architecture Notes
- Handles Android's incorrect smaller sigset_t size on x86 with explicit padding
- Uses socketcall multiplexing for socket operations on x86 instead of direct syscalls
- Maintains compatibility across different Android API levels through conditional implementations