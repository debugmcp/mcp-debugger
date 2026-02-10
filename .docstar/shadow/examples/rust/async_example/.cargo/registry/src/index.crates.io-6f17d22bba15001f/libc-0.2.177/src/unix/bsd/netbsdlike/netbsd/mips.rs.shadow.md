# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/netbsd/mips.rs
@source-hash: 20cdd8d1427c986e
@generated: 2026-02-09T17:57:08Z

**Purpose**: MIPS architecture-specific type definitions and constants for NetBSD system interface bindings in the libc crate.

**Key Components**:
- `__cpu_simple_lock_nv_t` (L4): CPU lock type alias mapped to `c_int` for MIPS architecture synchronization primitives
- `_ALIGNBYTES` (L6): Memory alignment constant set to `size_of::<c_longlong>() - 1` (7 bytes on MIPS), used for proper data structure alignment
- Process tracing constants (L8-11): Four PT_* constants derived from `PT_FIRSTMACH` base value for debugger/tracer operations:
  - `PT_GETREGS`: Get general-purpose registers
  - `PT_SETREGS`: Set general-purpose registers  
  - `PT_GETFPREGS`: Get floating-point registers
  - `PT_SETFPREGS`: Set floating-point registers

**Dependencies**: 
- `crate::prelude::*`: Core libc types and traits
- `crate::PT_FIRSTMACH`: Base constant for machine-specific ptrace operations

**Architecture Context**: This module provides MIPS-specific NetBSD system interface definitions, part of the hierarchical platform specialization pattern (`unix/bsd/netbsdlike/netbsd/mips.rs`). The alignment and lock type definitions ensure proper low-level system interaction on MIPS hardware.