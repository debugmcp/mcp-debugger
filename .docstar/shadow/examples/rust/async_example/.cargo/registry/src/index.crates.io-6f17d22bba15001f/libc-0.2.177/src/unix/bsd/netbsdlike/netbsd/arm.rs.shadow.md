# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/netbsd/arm.rs
@source-hash: f498ac1c11d0ebf6
@generated: 2026-02-09T17:57:14Z

## ARM-specific NetBSD System Bindings

This file provides ARM architecture-specific system constants and type definitions for NetBSD, part of the libc crate's Unix BSD family bindings.

### Key Components

**Type Definitions (L4)**:
- `__cpu_simple_lock_nv_t` (L4): CPU lock type alias to `c_int` for ARM architecture

**System Constants**:
- `_ALIGNBYTES` (L6): Memory alignment constant based on `c_longlong` size minus 1

**Process Tracing Constants (L8-11)**:
- `PT_GETREGS`, `PT_SETREGS` (L8-9): Get/set general purpose registers 
- `PT_GETFPREGS`, `PT_SETFPREGS` (L10-11): Get/set floating point registers
- All derived from `PT_FIRSTMACH` base constant

**ARM Register Mappings**:
- **32-bit ARM registers** (L13-29): `_REG_R0` through `_REG_R15` for general purpose registers, plus `_REG_CPSR` for status register
- **64-bit ARM registers** (L30-64): `_REG_X0` through `_REG_X31` for AArch64 registers, plus `_REG_ELR`, `_REG_SPSR`, `_REG_TIPDR` for special registers

**Register Aliases (L66-70)**:
- `_REG_RV` → `_REG_R0` (return value register)
- `_REG_FP` → `_REG_R11` (frame pointer)  
- `_REG_LR` → `_REG_R13` (link register)
- `_REG_SP` → `_REG_R14` (stack pointer)
- `_REG_PC` → `_REG_R15` (program counter)

### Dependencies
- Imports from crate prelude and `PT_FIRSTMACH` constant
- Part of NetBSD's ARM-specific system interface layer

### Architecture Notes
The file supports both 32-bit ARM and 64-bit AArch64 register sets, providing complete register enumeration for debugging and process control operations on NetBSD ARM systems.