# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/x86_64/mod.rs
@source-hash: b79601d4f5f297f2
@generated: 2026-02-09T17:58:17Z

## Purpose
FreeBSD x86_64-specific type definitions and structures for the libc crate. Provides low-level system interfaces for x86_64 architecture on FreeBSD, including register structures, floating-point representations, and machine context for process debugging and signal handling.

## Key Types (L3-7)
- `clock_t = i32`: Clock ticks counter
- `wchar_t = i32`: Wide character type 
- `time_t = i64`: Time representation
- `suseconds_t = i64`: Microseconds counter
- `register_t = i64`: CPU register value type

## Register Structures

### reg32 (L10-30)
32-bit x86 register set for debugging/ptrace operations. Contains all standard x86 32-bit registers (EAX, EBX, ECX, etc.) plus segment registers and flags.

### reg (L32-59)  
64-bit x86_64 register set for debugging/ptrace operations. Contains all x86_64 general-purpose registers (R15-R8, RDI-RAX) plus segment selectors and flags.

## Floating Point Structures (L63-83)

### fpreg32 (L63-68)
32-bit floating-point register state with 7-element environment array, 8 80-bit FP registers, and padding.

### fpreg (L70-75)
64-bit floating-point register state with 64-bit environment, 8 128-bit FP registers, 16 128-bit extended registers, and spare space.

### xmmreg (L77-82)
XMM/SSE register state with environment, accumulator registers, XMM registers, and padding.

## ELF Support (L84-93)

### __c_anonymous_elf64_auxv_union (L84-88)
Union for ELF auxiliary vector values - can hold integer, pointer, or function pointer.

### Elf64_Auxinfo (L90-93)
ELF auxiliary information structure with type and value union.

## Architecture Support

### max_align_t (L95-98)
16-byte aligned type for maximum alignment requirements.

### mcontext_t (L102-148) 
Machine context structure for signal handling and process state. Contains all CPU registers, floating-point state, and version-specific fields. Uses conditional compilation for FreeBSD version differences (pre-15 vs 15+).

## Trait Implementations (L152-324)
Conditional `PartialEq`, `Eq`, and `Hash` implementations for all structures when `extra_traits` feature is enabled. Notable special handling for union comparison using unsafe code (L217-225).

## Constants

### Alignment (L326)
`_ALIGNBYTES`: Platform-specific alignment constant based on `c_long` size.

### BPF/Network (L328-329)
- `BIOCSRTIMEOUT`/`BIOCGRTIMEOUT`: BPF read timeout control ioctls.

### Memory Management (L331-332)
- `MAP_32BIT`: Memory mapping flag for 32-bit address space
- `MINSIGSTKSZ`: Minimum signal stack size (2048 bytes)

### Machine Context Flags (L334-342)
Flags for `mcontext_t` indicating presence of segments, bases, and FPU extended state.

### File Information (L344)
`KINFO_FILE_SIZE`: Size constant for kernel file information structures.

### Terminal Control (L346)
`TIOCTIMESTAMP`: ioctl for terminal timestamp operations.

## Dependencies
- Uses `crate::prelude::*` for common libc types
- Relies on `s!` and `s_no_extra_traits!` macros for structure definition
- Uses `cfg_if!` for conditional compilation
- Uses `size_of` for alignment calculations

## Architecture Notes
This file is specifically for FreeBSD on x86_64 architecture. The structures mirror FreeBSD kernel definitions and are used for system calls, debugging interfaces (ptrace), and signal handling. Version-specific conditionals handle ABI differences across FreeBSD releases.