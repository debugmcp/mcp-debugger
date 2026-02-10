# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/riscv64.rs
@source-hash: 4e8e313c3a3736fb
@generated: 2026-02-09T17:57:13Z

**Primary Purpose**: FreeBSD RISC-V 64-bit architecture-specific type definitions and CPU context structures for the libc crate. This file provides low-level FFI bindings matching the FreeBSD kernel ABI on RISC-V 64-bit systems.

**Key Types and Structures**:

- **Basic Type Aliases (L3-7)**: Platform-specific type mappings
  - `clock_t = i32`, `wchar_t = c_int`, `time_t = i64` 
  - `suseconds_t = c_long`, `register_t = i64`

- **CPU Context Structures**:
  - `gpregs` (L10-20): General-purpose register context for RISC-V
    - Contains return address, stack pointer, global pointer, thread pointer
    - Register arrays for temporaries (`gp_t[7]`), saved registers (`gp_s[12]`), arguments (`gp_a[8]`)
    - Supervisor exception program counter and status
  - `fpregs` (L22-27): Floating-point register context
    - 32 128-bit FP registers (`fp_x`), control/status register (`fp_fcsr`)
    - Flags and padding for alignment
  - `mcontext_t` (L29-35): Complete machine context combining general and FP registers with metadata

**Conditional Trait Implementations (L38-108)**: 
- When "extra_traits" feature is enabled, implements `PartialEq`, `Eq`, and `Hash` for all context structures
- Custom implementations handle array comparisons correctly

**Architecture Constants**:
- `_ALIGNBYTES` (L110): Memory alignment requirement (7 bytes for 8-byte alignment)
- Platform-specific ioctl constants for BPF timeouts (L112-113)
- Memory mapping flag `MAP_32BIT` (L114) and signal stack size `MINSIGSTKSZ` (L115)
- TTY timestamp ioctl constant (L116)

**Dependencies**: 
- Uses `crate::prelude::*` for common libc types
- Leverages `s_no_extra_traits!` and `cfg_if!` macros for conditional compilation

**Architectural Patterns**: Follows libc crate's pattern of architecture-specific modules with FFI-safe struct layouts matching kernel ABI definitions. The conditional trait implementation pattern allows for optional debugging/testing capabilities while maintaining minimal dependencies.