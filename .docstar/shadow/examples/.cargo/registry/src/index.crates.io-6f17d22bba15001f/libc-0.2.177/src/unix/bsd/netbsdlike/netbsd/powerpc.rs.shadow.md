# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/netbsd/powerpc.rs
@source-hash: c19c4edbc73b5a97
@generated: 2026-02-09T18:02:08Z

This file defines PowerPC-specific constants and type definitions for NetBSD's libc binding in the Rust ecosystem.

**Primary Purpose:**
Platform-specific definitions for PowerPC architecture running NetBSD, providing low-level system interface constants and type aliases needed for system programming.

**Key Definitions:**
- `__cpu_simple_lock_nv_t` (L4): Type alias for simple CPU locking primitive, mapped to `c_int`
- `_ALIGNBYTES` (L6): Private constant defining memory alignment requirements as `size_of::<c_double>() - 1` (typically 7 bytes for 8-byte alignment)
- `PT_STEP` (L8): ptrace constant for single-step execution, offset from `PT_FIRSTMACH`
- `PT_GETREGS` (L9): ptrace constant for reading CPU registers, `PT_FIRSTMACH + 1`
- `PT_SETREGS` (L10): ptrace constant for writing CPU registers, `PT_FIRSTMACH + 2`

**Dependencies:**
- Imports from `crate::prelude::*` for common libc types
- Relies on `crate::PT_FIRSTMACH` for ptrace constant base value

**Architectural Context:**
Part of a hierarchical module structure (`unix/bsd/netbsdlike/netbsd/powerpc`), providing the most specific layer of platform abstractions. The ptrace constants enable debugging and process control functionality specific to PowerPC NetBSD systems.

**Usage Pattern:**
These constants are typically consumed by system-level debugging tools, process introspection utilities, and low-level system programming interfaces that need to interact with PowerPC-specific kernel features on NetBSD.