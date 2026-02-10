# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/powerpc.rs
@source-hash: 809148c48a16cef7
@generated: 2026-02-09T18:02:13Z

## Purpose
FreeBSD PowerPC-specific type definitions and constants for the libc crate. Provides architecture-specific implementations of POSIX types and system call constants that differ between platforms.

## Key Components

### Type Aliases (L3-7)
- `clock_t = u32` - Clock tick counter type
- `wchar_t = i32` - Wide character type  
- `time_t = i64` - Time value type
- `suseconds_t = i32` - Microseconds type for timevals
- `register_t = i32` - CPU register value type

### Machine Context Structure (L11-21)
- `mcontext_t` - CPU context preservation struct with 16-byte alignment
  - `mc_vers, mc_flags, mc_onstack, mc_len` (L12-15): Metadata fields
  - `mc_avec[64]` (L16): 64-bit vector register array
  - `mc_av[2]` (L17): 32-bit auxiliary vector
  - `mc_frame[42]` (L18): General-purpose registers using `crate::register_t`
  - `mc_fpreg[33]` (L19): Floating-point registers
  - `mc_vsxfpreg[32]` (L20): VSX floating-point registers

### Conditional Traits (L24-54)
When `extra_traits` feature is enabled:
- `PartialEq` implementation (L26-38): Field-by-field comparison
- `Eq` marker trait (L39)
- `Hash` implementation (L40-52): Hashes all fields in sequence

### Constants (L56-61)
- `_ALIGNBYTES` (L56): Memory alignment constant based on `c_int` size
- `BIOCSRTIMEOUT/BIOCGRTIMEOUT` (L58-59): BPF timeout ioctl commands
- `MAP_32BIT` (L60): Memory mapping flag for 32-bit address space
- `MINSIGSTKSZ` (L61): Minimum signal stack size (2048 bytes)
- `TIOCTIMESTAMP` (L61): TTY timestamp ioctl command

## Dependencies
- `crate::prelude::*`: Core libc types and macros
- `s_no_extra_traits!` macro: Conditionally excludes trait derivations
- `cfg_if!` macro: Conditional compilation
- `crate::register_t`: Cross-references register type definition

## Architectural Notes
- PowerPC-specific register layout with separate vector and floating-point register arrays
- VSX (Vector Scalar Extension) register support indicates modern PowerPC variants
- 16-byte alignment requirement for context structure reflects SIMD register alignment needs