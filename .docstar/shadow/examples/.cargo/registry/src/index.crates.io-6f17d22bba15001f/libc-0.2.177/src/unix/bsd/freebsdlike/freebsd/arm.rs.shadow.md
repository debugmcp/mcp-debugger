# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/arm.rs
@source-hash: 6e938534090f8504
@generated: 2026-02-09T18:02:11Z

## Purpose
ARM-specific type definitions and constants for FreeBSD libc bindings. Provides platform-specific primitive types, machine context structure, and system constants required for ARM architecture on FreeBSD systems.

## Key Type Definitions (L3-9)
- **Primitive types**: `clock_t` (u32), `wchar_t` (u32), `time_t` (i64), `suseconds_t` (i32), `register_t` (i32) - Standard C types with ARM-specific sizes
- **Register types**: `__greg_t` (c_uint), `__gregset_t` ([__greg_t; 17]) - General purpose register representations for signal/context handling

## Core Structure
- **mcontext_t (L12-18)**: Machine context structure for signal handling and process state
  - `__gregs`: Array of 17 general-purpose registers
  - `mc_vfp_size`/`mc_vfp_ptr`: Vector Floating Point unit state management
  - `mc_spare`: 33-element spare field array for future extensions

## Conditional Trait Implementations (L20-44)
Feature-gated trait implementations for `mcontext_t` when "extra_traits" is enabled:
- **PartialEq (L22-33)**: Field-by-field comparison including array iteration for spare fields
- **Eq (L34)**: Marker trait implementation
- **Hash (L35-42)**: Hashes all fields including register arrays

## Constants (L46-53)
- **_ALIGNBYTES (L46)**: Memory alignment constant based on `c_int` size
- **BIO* constants (L48-49)**: Berkeley Packet Filter timeout ioctls
- **MAP_32BIT (L51)**: Memory mapping flag for 32-bit address space
- **MINSIGSTKSZ (L52)**: Minimum signal stack size (4KB for ARM)
- **TIOCTIMESTAMP (L53)**: Terminal I/O timestamp ioctl

## Dependencies
- Uses `crate::prelude::*` for common libc types and macros
- Relies on `s_no_extra_traits!` macro for conditional struct definition
- Uses `cfg_if!` for feature-conditional compilation