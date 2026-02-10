# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/openbsd/riscv64.rs
@source-hash: c93baaf8e3afa8c7
@generated: 2026-02-09T17:57:13Z

## Purpose
Platform-specific system definitions for OpenBSD on RISC-V 64-bit architecture. Part of the libc crate's Unix compatibility layer, providing low-level system structures and constants for signal handling and memory management on this specific platform.

## Key Structures

### sigcontext (L6-20)
Signal context structure representing CPU state during signal delivery on RISC-V 64:
- **sc_mask** (L8): Signal mask
- **sc_ra, sc_sp, sc_gp, sc_tp** (L9-12): Core RISC-V registers (return address, stack pointer, global pointer, thread pointer)
- **sc_t** (L13): Temporary registers array [7]
- **sc_s** (L14): Saved registers array [12] 
- **sc_a** (L15): Argument registers array [8]
- **sc_sepc** (L16): Supervisor exception program counter
- **sc_f** (L17): Floating-point registers array [32]
- **sc_fcsr** (L18): Floating-point control/status register
- **sc_cookie** (L19): Security cookie for stack protection

### Type Aliases
- **ucontext_t** (L3): Aliases to sigcontext for POSIX compatibility

## Constants
- **_ALIGNBYTES** (L23): Memory alignment constant (size_of::<c_long>() - 1)
- **_MAX_PAGE_SHIFT** (L25): Maximum page size shift value (12, indicating 4KB pages)

## Dependencies
- Uses crate prelude (L1) for common types like c_int, c_long
- Wrapped in s! macro for structure definition (libc crate convention)

## Architecture Notes
This file is highly architecture-specific, containing the exact register layout and system constants for OpenBSD RISC-V 64-bit. The sigcontext structure mirrors the hardware register file organization of RISC-V processors.