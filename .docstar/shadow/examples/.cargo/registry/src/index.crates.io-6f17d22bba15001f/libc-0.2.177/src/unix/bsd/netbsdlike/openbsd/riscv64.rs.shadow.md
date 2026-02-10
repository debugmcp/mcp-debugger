# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/openbsd/riscv64.rs
@source-hash: c93baaf8e3afa8c7
@generated: 2026-02-09T18:02:12Z

## Purpose
Platform-specific definitions for OpenBSD on RISC-V 64-bit architecture, providing signal context structures and memory alignment constants for the libc crate.

## Key Types and Definitions

**ucontext_t (L3)**: Type alias mapping to `sigcontext` - standard POSIX user context type for signal handling

**sigcontext (L6-20)**: Signal context structure capturing complete CPU state during signal delivery:
- `__sc_unused` (L7): Reserved/padding field 
- `sc_mask` (L8): Signal mask state
- `sc_ra` (L9): Return address register
- `sc_sp` (L10): Stack pointer register  
- `sc_gp` (L11): Global pointer register
- `sc_tp` (L12): Thread pointer register
- `sc_t` (L13): Temporary registers array [7 elements]
- `sc_s` (L14): Saved registers array [12 elements]  
- `sc_a` (L15): Argument registers array [8 elements]
- `sc_sepc` (L16): Supervisor exception program counter
- `sc_f` (L17): Floating-point registers array [32 elements]
- `sc_fcsr` (L18): Floating-point control/status register
- `sc_cookie` (L19): Security cookie for stack protection

## Constants

**_ALIGNBYTES (L23)**: Memory alignment mask constant - `sizeof(c_long) - 1` for proper data structure alignment on RISC-V 64-bit

**_MAX_PAGE_SHIFT (L25)**: Maximum page size shift value (12 = 4KB pages), defining memory management boundaries

## Dependencies
- `crate::prelude::*` (L1): Core libc type definitions and macros
- Uses `s!` macro for structure definition (platform-specific struct declaration)

## Architecture Notes  
RISC-V 64-bit specific register layout following OpenBSD's signal context ABI. The structure preserves complete processor state including general-purpose registers, floating-point unit state, and security features.