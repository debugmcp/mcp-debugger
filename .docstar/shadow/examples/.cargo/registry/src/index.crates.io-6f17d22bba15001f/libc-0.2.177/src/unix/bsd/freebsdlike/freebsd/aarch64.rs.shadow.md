# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/aarch64.rs
@source-hash: 246e20e9a143d4ac
@generated: 2026-02-09T18:02:12Z

## Purpose
FreeBSD AArch64-specific type definitions and system structures for the libc crate. Provides architecture-specific primitive type aliases and processor context structures needed for low-level system programming on FreeBSD ARM64 systems.

## Key Type Aliases (L3-7)
- `clock_t = i32` - Clock tick counter type
- `wchar_t = u32` - Wide character type (32-bit Unicode)
- `time_t = i64` - Time representation type
- `suseconds_t = i64` - Microsecond time interval type
- `register_t = i64` - CPU register value type (64-bit for AArch64)

## Core Structures

### `gpregs` (L10-17)
General-purpose register context structure for AArch64:
- `gp_x[30]` - Array of 30 general-purpose registers (X0-X29)
- `gp_lr` - Link register (X30)
- `gp_sp` - Stack pointer
- `gp_elr` - Exception link register
- `gp_spsr` - Saved program status register
- `gp_pad` - Padding for alignment

### `fpregs` (L19-25)
Floating-point register context structure:
- `fp_q` - 128-bit SIMD/FP register
- `fp_sr` - Status register
- `fp_cr` - Control register
- `fp_flags` - Floating-point flags
- `fp_pad` - Padding for alignment

### `mcontext_t` (L27-33)
Complete machine context structure combining:
- `mc_gpregs` - General-purpose registers
- `mc_fpregs` - Floating-point registers
- `mc_flags` - Context flags
- `mc_pad` - Padding
- `mc_spare[8]` - Reserved space for future extensions

## Conditional Trait Implementations (L38-104)
When `extra_traits` feature is enabled, provides `PartialEq`, `Eq`, and `Hash` implementations for all three structures. Uses field-by-field comparison and hashing.

## Constants
- `_ALIGNBYTES` (L36) - Architecture alignment requirement (7 bytes for 64-bit)
- `BIOCSRTIMEOUT`/`BIOCGRTIMEOUT` (L106-107) - BPF timeout ioctl constants
- `MAP_32BIT` (L108) - Memory mapping flag for 32-bit address space
- `MINSIGSTKSZ` (L109) - Minimum signal stack size (4KB)
- `TIOCTIMESTAMP` (L110) - TTY timestamp ioctl constant

## Architectural Notes
Uses `s_no_extra_traits!` macro to conditionally exclude trait derivations, allowing manual implementation when `extra_traits` feature is enabled. All structures are C-compatible for FFI with FreeBSD kernel interfaces.