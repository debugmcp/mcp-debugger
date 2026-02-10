# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/netbsd/mips.rs
@source-hash: 20cdd8d1427c986e
@generated: 2026-02-09T18:02:06Z

## NetBSD MIPS Architecture Specific Constants and Types

This file provides MIPS architecture-specific type definitions and constants for NetBSD systems within the libc crate's Unix/BSD hierarchy.

### Key Definitions

**Type Definitions:**
- `__cpu_simple_lock_nv_t` (L4): Architecture-specific CPU lock type aliased to `c_int` for MIPS systems

**Memory Alignment:**
- `_ALIGNBYTES` (L6): Internal alignment constant calculated as `size_of::<c_longlong>() - 1`, defining the MIPS-specific memory alignment boundary

**Process Tracing Constants:**
- `PT_GETREGS` (L8): Process tracing constant for getting general-purpose registers (`PT_FIRSTMACH + 1`)
- `PT_SETREGS` (L9): Process tracing constant for setting general-purpose registers (`PT_FIRSTMACH + 2`)
- `PT_GETFPREGS` (L10): Process tracing constant for getting floating-point registers (`PT_FIRSTMACH + 3`)
- `PT_SETFPREGS` (L11): Process tracing constant for setting floating-point registers (`PT_FIRSTMACH + 4`)

### Dependencies
- `crate::prelude::*`: Common type definitions and utilities
- `crate::PT_FIRSTMACH`: Base constant for machine-specific process tracing operations

### Architecture Context
Part of the libc crate's platform-specific abstraction layer, providing MIPS-specific definitions for NetBSD systems. The constants follow NetBSD's ptrace(2) interface conventions for MIPS architecture register manipulation.