# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/powerpc64.rs
@source-hash: 8ec51f2eb1eae150
@generated: 2026-02-09T17:57:09Z

## Purpose
Platform-specific type definitions and constants for PowerPC64 architecture on FreeBSD systems within the libc crate. Provides low-level system interface bindings.

## Key Type Definitions (L3-7)
- `clock_t = u32`: System clock tick type
- `wchar_t = i32`: Wide character type
- `time_t = i64`: Time representation type
- `suseconds_t = i64`: Microseconds type for time calculations
- `register_t = i64`: CPU register value type

## Core Structure
### mcontext_t (L11-21)
Machine context structure for PowerPC64 signal handling and context switching:
- 16-byte aligned (`#[repr(align(16))]`)
- Contains processor state: version, flags, stack info, vector registers, frame registers, floating-point registers
- Key fields:
  - `mc_avec[64]`: AltiVec registers (64-bit each)
  - `mc_frame[42]`: General purpose registers
  - `mc_fpreg[33]`: Floating-point registers
  - `mc_vsxfpreg[32]`: VSX floating-point registers

## Conditional Trait Implementations (L24-54)
When `extra_traits` feature is enabled, implements `PartialEq`, `Eq`, and `Hash` for `mcontext_t` with field-by-field comparison and hashing.

## Platform Constants (L56-63)
- `_ALIGNBYTES`: Memory alignment calculation
- `BIOCSRTIMEOUT`/`BIOCGRTIMEOUT`: Berkeley Packet Filter timeout ioctls
- `MAP_32BIT`: Memory mapping flag for 32-bit address space
- `MINSIGSTKSZ = 2048`: Minimum signal stack size
- `TIOCTIMESTAMP`: Terminal timestamp ioctl

## Dependencies
- `crate::prelude::*`: Core libc types and macros
- Uses `s_no_extra_traits!` macro for conditional struct definition
- Uses `cfg_if!` for conditional compilation