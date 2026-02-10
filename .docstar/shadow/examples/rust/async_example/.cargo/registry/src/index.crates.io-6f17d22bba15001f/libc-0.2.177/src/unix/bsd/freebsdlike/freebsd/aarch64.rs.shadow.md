# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/aarch64.rs
@source-hash: 246e20e9a143d4ac
@generated: 2026-02-09T17:57:09Z

## Purpose
FreeBSD aarch64-specific type definitions and system structures for libc bindings. Provides low-level OS interface types for ARM64 architecture on FreeBSD systems.

## Key Type Aliases (L3-7)
- `clock_t` → `i32`: Process time measurement
- `wchar_t` → `u32`: Wide character representation  
- `time_t` → `i64`: Unix timestamp
- `suseconds_t` → `i64`: Microseconds for time structures
- `register_t` → `i64`: CPU register storage type

## System Structures
### `gpregs` (L10-17)
General purpose register context for ARM64 CPU state:
- `gp_x`: Array of 30 general registers
- `gp_lr`: Link register (return address)
- `gp_sp`: Stack pointer
- `gp_elr`: Exception link register
- `gp_spsr`: Saved program status register
- `gp_pad`: Alignment padding

### `fpregs` (L19-25)
Floating-point register context:
- `fp_q`: 128-bit floating-point register
- `fp_sr`: Status register
- `fp_cr`: Control register
- `fp_flags`: Floating-point flags
- `fp_pad`: Alignment padding

### `mcontext_t` (L27-33)
Complete machine context combining both register sets with metadata fields for signal handling and context switching.

## Architecture Constants
- `_ALIGNBYTES` (L36): Memory alignment requirement based on `c_longlong`
- `MINSIGSTKSZ` (L109): Minimum signal stack size (4KB for ARM64)
- Platform-specific ioctl constants for BPF and TTY operations (L106-110)

## Conditional Trait Implementations (L38-104)
When `extra_traits` feature is enabled, provides `PartialEq`, `Eq`, and `Hash` implementations for all structures. Uses field-by-field comparison and array iteration for complex types.

## Dependencies
- `crate::prelude::*`: Core libc types and macros
- `s_no_extra_traits!` macro: Conditional struct definition system