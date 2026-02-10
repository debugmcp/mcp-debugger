# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/netbsd/riscv64.rs
@source-hash: efa1a156cff1ab24
@generated: 2026-02-09T17:57:15Z

## NetBSD RISC-V 64-bit Platform Definitions

This file provides platform-specific type definitions and constants for NetBSD on RISC-V 64-bit architecture, part of the libc crate's Unix BSD family.

### Core Types
- `__greg_t` (L5): 64-bit general purpose register type
- `__cpu_simple_lock_nv_t` (L6): Simple lock type using `c_int`
- `__gregset` (L7): Array of 32 general registers (`[__greg_t; _NGREG]`)
- `__fregset` (L8): Array of 33 floating-point registers (`[__freg; _NFREG]`)

### Key Structures
- `mcontext_t` (L11-16): Machine context structure containing general registers (`__gregs`), floating-point registers (`__fregs`), and spare space for future extensions
- `__fpreg` (L19-23): Union for floating-point register representation, supporting both 64-bit integer (`u_u64`) and double-precision float (`u_d`) access

### Constants
- `_ALIGNBYTES` (L25): Memory alignment requirement based on `c_long` size
- Ptrace constants (L27-30): Machine-specific ptrace operations for register manipulation
  - `PT_GETREGS/PT_SETREGS`: General register access
  - `PT_GETFPREGS/PT_SETFPREGS`: Floating-point register access
- Register counts (L32-33): 32 general registers, 33 FP registers
- General register indices (L35-66): X1-X31 registers plus PC register
- Register aliases (L68-74): ABI-standard names mapping to X registers (RA=X1, SP=X2, etc.)
- Floating-point register indices (L76-77): F0 register and FPCSR control register

### Architecture Notes
Uses RISC-V calling convention with standard register mappings. The `s!` and `s_no_extra_traits!` macros indicate special handling for C structure compatibility and trait derivation respectively.