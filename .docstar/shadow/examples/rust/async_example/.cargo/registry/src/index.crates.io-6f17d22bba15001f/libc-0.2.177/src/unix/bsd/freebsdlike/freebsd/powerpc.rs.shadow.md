# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/powerpc.rs
@source-hash: 809148c48a16cef7
@generated: 2026-02-09T17:57:10Z

## Primary Purpose
Platform-specific type definitions and constants for PowerPC architecture on FreeBSD systems. Part of the libc crate's Unix BSD FreeBSD architecture hierarchy.

## Key Type Definitions (L3-7)
- `clock_t = u32`: Clock time type for timing operations
- `wchar_t = i32`: Wide character type (32-bit signed)
- `time_t = i64`: Unix timestamp type (64-bit signed)  
- `suseconds_t = i32`: Microseconds component type
- `register_t = i32`: CPU register value type

## Core Structure
- `mcontext_t` (L11-21): Machine context structure for signal handling and process state preservation
  - 16-byte aligned for PowerPC architecture requirements
  - Contains CPU state: registers (`mc_frame`), floating-point registers (`mc_fpreg`), VSX registers (`mc_vsxfpreg`)
  - Includes metadata: version (`mc_vers`), flags (`mc_flags`), stack info (`mc_onstack`, `mc_len`)
  - Uses AltiVec vector registers (`mc_avec`, `mc_av`)

## Conditional Trait Implementations (L24-54)
- `PartialEq`, `Eq`, `Hash` for `mcontext_t` when "extra_traits" feature enabled
- Field-by-field comparison and hashing implementation

## Architecture Constants (L56-62)
- `_ALIGNBYTES` (L56): Memory alignment constant based on `c_int` size
- `BIOCSRTIMEOUT`/`BIOCGRTIMEOUT` (L58-59): BPF timeout ioctl constants
- `MAP_32BIT` (L60): Memory mapping flag for 32-bit address space
- `MINSIGSTKSZ` (L61): Minimum signal stack size (2048 bytes)
- `TIOCTIMESTAMP` (L62): Terminal timestamp ioctl constant

## Dependencies
- `crate::prelude::*`: Core libc types and macros
- `s_no_extra_traits!`: Macro for struct definition without default traits
- `cfg_if!`: Conditional compilation macro

## Architectural Context
PowerPC-specific definitions within FreeBSD's libc bindings, handling low-level system interfaces, signal contexts, and memory management for this architecture.