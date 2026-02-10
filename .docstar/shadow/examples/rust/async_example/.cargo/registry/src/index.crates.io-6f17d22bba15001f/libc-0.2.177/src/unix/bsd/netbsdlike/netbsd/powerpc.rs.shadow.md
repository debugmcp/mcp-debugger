# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/netbsd/powerpc.rs
@source-hash: c19c4edbc73b5a97
@generated: 2026-02-09T17:57:09Z

**Purpose**: Platform-specific type definitions and constants for PowerPC architecture on NetBSD systems, part of the libc crate's Unix/BSD compatibility layer.

**Key Elements**:
- `__cpu_simple_lock_nv_t` (L4): Type alias defining CPU simple lock as `c_int` for PowerPC NetBSD
- `_ALIGNBYTES` (L6): Platform-specific alignment constant calculated as `size_of::<c_double>() - 1`, used for memory alignment requirements
- `PT_STEP`, `PT_GETREGS`, `PT_SETREGS` (L8-10): Process tracing constants building on `PT_FIRSTMACH` base, providing PowerPC-specific ptrace operations

**Dependencies**:
- `crate::prelude::*`: Core libc types and traits
- `crate::PT_FIRSTMACH`: Base constant for machine-specific ptrace operations

**Architecture Notes**:
- Part of hierarchical platform specialization: unix/bsd/netbsdlike/netbsd/powerpc
- Follows libc pattern of incremental constant definitions (PT_FIRSTMACH + offset)
- Memory alignment based on double-precision float size typical for PowerPC architecture

**Usage Context**: Enables low-level system programming, process debugging, and memory management on PowerPC NetBSD systems through standardized C library interface.