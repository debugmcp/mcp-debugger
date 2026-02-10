# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b64/aarch64/mod.rs
@source-hash: 6d4fcf287ee09d65
@generated: 2026-02-09T17:58:14Z

## AArch64 Android Platform Bindings

**Purpose**: Platform-specific type definitions, structure layouts, and system call numbers for AArch64 (ARM64) architecture on Android. Part of the libc crate's Unix/Linux-like/Android hierarchy.

**Dependencies**:
- Uses `crate::off64_t`, `crate::prelude::*` for base type definitions
- Inherits from parent Android module structure

### Core Type Definitions (L4-6)
- `wchar_t = u32`: Wide character type (32-bit on AArch64)
- `__u64 = c_ulonglong`, `__s64 = c_longlong`: 64-bit integer types

### Key Structures

**File System Metadata**:
- `stat` (L9-30): Standard file status structure with nanosecond timestamp precision, uses `off64_t` for size
- `stat64` (L32-53): Identical to `stat` - on 64-bit systems, both are equivalent

**CPU/Debug Structures**:
- `user_regs_struct` (L55-60): AArch64 CPU register state for debugging (31 general registers + SP, PC, PSTATE)
- `user_fpsimd_struct` (L80-84): Floating-point/SIMD register state (32 128-bit vector registers + control registers)

**Signal Handling**:
- `ucontext_t` (L62-68): Signal context containing flags, stack, signal mask, and machine context
- `mcontext_t` (L70-78): Machine-specific context with 16-byte alignment, fault address, and reserved space for extensions

**Memory Alignment**:
- `max_align_t` (L88-91): 16-byte aligned type for maximum alignment requirements

### Platform Constants

**File Operations** (L94-97):
- O_DIRECT, O_DIRECTORY, O_NOFOLLOW, O_LARGEFILE flags

**Signal Stack** (L99-100):
- SIGSTKSZ (16384), MINSIGSTKSZ (5120): Stack size constants

**Hardware Capabilities** (L102-168):
- HWCAP_* constants: CPU feature detection flags (FP, ASIMD, AES, etc.)
- HWCAP2_* constants: Extended feature flags for newer ARM features (SVE, MTE, SME)

**Memory Protection** (L468-469):
- PROT_BTI, PROT_MTE: AArch64-specific memory protection flags for Branch Target Identification and Memory Tagging Extension

**System Calls** (L170-466):
Complete AArch64 syscall number mapping from 0 (io_setup) to 451 (syscalls). Notable gaps exist (e.g., missing 43-46, 71, 79-80, 223) reflecting architecture-specific syscall table.

**Auxiliary Vector** (L472-473):
- AT_SYSINFO_EHDR, AT_VECTOR_SIZE_ARCH: ELF auxiliary vector constants

### Architecture Notes
- Uses `s!` macro for standard struct definitions and `s_no_extra_traits!` for alignment-critical types
- All structures follow AArch64 ABI alignment requirements
- System call numbers are architecture-specific, different from x86_64