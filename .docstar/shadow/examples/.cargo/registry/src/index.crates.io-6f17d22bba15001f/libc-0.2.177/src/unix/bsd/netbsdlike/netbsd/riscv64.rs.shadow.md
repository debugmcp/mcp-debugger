# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/netbsd/riscv64.rs
@source-hash: efa1a156cff1ab24
@generated: 2026-02-09T18:02:13Z

**Purpose**: NetBSD RISC-V 64-bit architecture-specific low-level system interface definitions for the libc crate. Provides machine context structures, register definitions, and ptrace constants needed for debugging and system calls on NetBSD RISC-V64 systems.

**Key Types**:
- `__greg_t` (L5): 64-bit general register type
- `__cpu_simple_lock_nv_t` (L6): Simple lock type as c_int
- `__gregset` (L7): Array of 32 general registers
- `__fregset` (L8): Array of 33 floating-point registers
- `mcontext_t` (L11-15): Machine context structure containing general registers, FP registers, and spare space
- `__fpreg` (L19-22): Union for floating-point register representation (u64 or double)

**Dependencies**:
- Imports `PT_FIRSTMACH` from parent scope
- Uses `crate::prelude::*` for common types
- References `crate::__greg_t` in mcontext_t definition

**Constants**:
- **Alignment**: `_ALIGNBYTES` (L25) - memory alignment boundary
- **Ptrace operations** (L27-30): PT_GETREGS, PT_SETREGS, PT_GETFPREGS, PT_SETFPREGS for debugging
- **Register counts** (L32-33): 32 general registers, 33 FP registers  
- **General register indices** (L35-66): _REG_X1 through _REG_PC mapping RISC-V registers to array indices
- **Register aliases** (L68-74): Semantic names (RA, SP, GP, TP, etc.) mapping to X register numbers
- **FP register indices** (L76-77): _REG_F0 and _REG_FPCSR for floating-point operations

**Architecture Notes**:
- RISC-V64 follows standard 32 general register + PC convention
- Floating-point includes 32 data registers + 1 control/status register
- Uses libc's `s!` and `s_no_extra_traits!` macros for structure definitions
- Register aliases follow RISC-V ABI naming conventions (RA=return address, SP=stack pointer, etc.)