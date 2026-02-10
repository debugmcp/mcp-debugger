# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/netbsd/aarch64.rs
@source-hash: ba2425edbf025f13
@generated: 2026-02-09T17:57:15Z

## NetBSD AArch64 System Types and Constants

This file defines low-level system types and constants specific to NetBSD on AArch64 architecture, part of the libc crate's Unix/BSD compatibility layer.

**Core Types:**
- `greg_t` (L4): General-purpose register type, defined as `u64` for 64-bit AArch64 registers
- `__cpu_simple_lock_nv_t` (L5): CPU lock primitive type using `c_uchar`

**Key Structures:**

**`__fregset` (L8-12)**: Floating-point register set containing:
- `__qregs`: Array of 32 quad-word floating-point registers using `__c_anonymous__freg` union
- `__fpcr`: Floating-point control register (32-bit)
- `__fpsr`: Floating-point status register (32-bit)

**`mcontext_t` (L14-18)**: Machine context structure for signal handling/context switching:
- `__gregs`: Array of 32 general-purpose registers 
- `__fregs`: Complete floating-point register set
- `__spare`: 8 reserved registers for future use

**`ucontext_t` (L20-26)**: User context structure for signal handling:
- Standard POSIX fields: flags, link pointer, signal mask, stack info
- `uc_mcontext`: Machine-specific context data

**`__c_anonymous__freg` (L31-37)**: 16-byte aligned union representing floating-point register data in multiple formats:
- `__b8`: 16 bytes, `__h16`: 8 half-words, `__s32`: 4 words, `__d64`: 2 double-words, `__q128`: 1 quad-word
- Conditional trait implementations (L42-65) for `PartialEq`, `Eq`, and `Hash` when "extra_traits" feature enabled

**Constants:**
- `_ALIGNBYTES` (L68): Memory alignment constant
- `PT_*` constants (L70-73): Process tracing operations for register access
- `_REG_R*` constants (L75-91): ARM 32-bit register indices for compatibility
- `_REG_X*` constants (L92-126): AArch64 64-bit register indices (X0-X31, ELR, SPSR, TIPDR)  
- Register aliases (L128-131): Semantic mappings (RV=X0, FP=X29, LR=X30, SP=X31, PC=ELR)

**Dependencies:**
- Uses crate prelude and `PT_FIRSTMACH` constant
- Relies on `s!` and `s_no_extra_traits!` macros for structure definition
- Uses `cfg_if!` for conditional compilation of trait implementations

**Architecture Notes:**
- Bridges ARM 32-bit (_REG_R*) and AArch64 64-bit (_REG_X*) register naming conventions
- Provides complete low-level access to AArch64 processor state for debugging and signal handling