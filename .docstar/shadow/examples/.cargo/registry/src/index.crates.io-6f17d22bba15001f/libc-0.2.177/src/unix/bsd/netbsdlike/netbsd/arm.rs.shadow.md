# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/netbsd/arm.rs
@source-hash: f498ac1c11d0ebf6
@generated: 2026-02-09T18:02:09Z

## ARM Architecture Support for NetBSD

This file provides ARM-specific platform definitions for NetBSD systems within the libc crate. It defines low-level system interfaces required for ARM processors on NetBSD.

### Key Components

**Type Definitions (L4)**
- `__cpu_simple_lock_nv_t`: CPU simple lock type aliased to `c_int`

**Memory Alignment (L6)**
- `_ALIGNBYTES`: Memory alignment constraint based on `c_longlong` size minus 1

**Process Tracing Constants (L8-11)**
- `PT_GETREGS`, `PT_SETREGS`: General purpose register access for ptrace
- `PT_GETFPREGS`, `PT_SETFPREGS`: Floating point register access for ptrace
- All derived from `PT_FIRSTMACH` base value with sequential offsets

**ARM32 Register Definitions (L13-29)**
- `_REG_R0` through `_REG_R15`: General purpose registers R0-R15 (values 0-15)
- `_REG_CPSR`: Current Program Status Register (value 16)

**ARM64 Register Definitions (L30-64)**
- `_REG_X0` through `_REG_X31`: 64-bit general purpose registers X0-X31 (values 0-31)
- `_REG_ELR`: Exception Link Register (value 32)
- `_REG_SPSR`: Saved Program Status Register (value 33)
- `_REG_TIPDR`: Thread ID Pointer Register (value 34)

**Register Aliases (L66-70)**
- `_REG_RV`: Return value register (aliased to R0)
- `_REG_FP`: Frame pointer (aliased to R11)
- `_REG_LR`: Link register (aliased to R13)
- `_REG_SP`: Stack pointer (aliased to R14)
- `_REG_PC`: Program counter (aliased to R15)

### Dependencies
- Imports from `crate::prelude::*` for common types
- Uses `PT_FIRSTMACH` constant for ptrace command base values

### Architectural Notes
- Supports both ARM32 and ARM64 register sets simultaneously
- Register numbering follows standard ARM ABI conventions
- Process tracing support enables debugger functionality
- Memory alignment follows platform-specific requirements