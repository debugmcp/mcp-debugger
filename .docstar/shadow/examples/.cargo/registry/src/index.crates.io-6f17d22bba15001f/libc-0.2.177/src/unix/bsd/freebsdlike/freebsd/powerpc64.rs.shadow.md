# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/powerpc64.rs
@source-hash: 8ec51f2eb1eae150
@generated: 2026-02-09T18:02:13Z

## PowerPC64 FreeBSD Type Definitions and Platform Constants

This file provides PowerPC64-specific type definitions and constants for FreeBSD systems within the libc crate's BSD/FreeBSD architecture hierarchy.

### Core Type Definitions (L3-7)
- `clock_t`: 32-bit unsigned integer for clock ticks
- `wchar_t`: 32-bit signed integer for wide characters  
- `time_t`: 64-bit signed integer for time representation
- `suseconds_t`: 64-bit signed integer for microsecond values
- `register_t`: 64-bit signed integer for CPU registers

### Machine Context Structure (L9-22)
`mcontext_t` (L11-21): 16-byte aligned structure representing saved CPU context during signal handling or context switches. Contains:
- Version and control fields (`mc_vers`, `mc_flags`, `mc_onstack`, `mc_len`)
- AltiVec/VMX register state (`mc_avec[64]`, `mc_av[2]`) 
- General purpose registers (`mc_frame[42]`)
- Floating point registers (`mc_fpreg[33]`)
- VSX floating point registers (`mc_vsxfpreg[32]`)

Uses `s_no_extra_traits!` macro to conditionally exclude standard trait derivations.

### Conditional Trait Implementations (L24-54)
When `extra_traits` feature is enabled:
- `PartialEq` implementation (L26-38): Field-by-field comparison
- `Eq` marker trait (L39)
- `Hash` implementation (L40-52): Hashes all fields sequentially

### Platform Constants (L56-63)
- `_ALIGNBYTES` (L56): Alignment mask based on `c_long` size
- Berkeley Packet Filter timeout ioctls: `BIOCSRTIMEOUT`, `BIOCGRTIMEOUT` (L58-59)
- Memory mapping flag `MAP_32BIT` (L61): Forces 32-bit address space
- `MINSIGSTKSZ` (L62): Minimum signal stack size (2048 bytes)
- `TIOCTIMESTAMP` (L63): Terminal timestamp ioctl command

### Dependencies
- Imports common libc prelude types and macros
- References `crate::register_t` for register array type
- Uses `cfg_if!` for conditional compilation
- Relies on standard library `hash` module for trait implementations

### Architectural Notes
This file is part of the libc crate's platform-specific type system, providing PowerPC64 definitions that override or supplement generic BSD/FreeBSD types. The `mcontext_t` structure is critical for signal handling and reflects PowerPC64's register architecture including AltiVec and VSX extensions.