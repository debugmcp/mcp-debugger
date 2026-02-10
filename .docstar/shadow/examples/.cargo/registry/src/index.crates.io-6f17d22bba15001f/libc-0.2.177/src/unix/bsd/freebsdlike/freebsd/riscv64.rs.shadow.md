# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/riscv64.rs
@source-hash: 4e8e313c3a3736fb
@generated: 2026-02-09T18:02:11Z

**Purpose:** Architecture-specific type definitions and constants for RISC-V 64-bit FreeBSD systems in the libc crate. Provides low-level system types and register structures for RISC-V architecture interfacing with FreeBSD kernel.

**Key Type Definitions (L3-7):**
- `clock_t = i32`: System clock type
- `wchar_t = c_int`: Wide character type  
- `time_t = i64`: Time representation type
- `suseconds_t = c_long`: Microseconds type
- `register_t = i64`: CPU register type (64-bit for RISC-V)

**Core Structures:**
- **`gpregs` (L10-20)**: General purpose register context structure containing RISC-V register state including return address (`gp_ra`), stack pointer (`gp_sp`), temporary registers (`gp_t[7]`), saved registers (`gp_s[12]`), argument registers (`gp_a[8]`), and exception program counter (`gp_sepc`)
- **`fpregs` (L22-27)**: Floating-point register context with 32 128-bit FP registers (`fp_x`), floating-point control/status register (`fp_fcsr`), and flags
- **`mcontext_t` (L29-35)**: Complete machine context combining general purpose and floating-point register sets with metadata fields

**Trait Implementations:**
Uses conditional compilation (`cfg_if!`, L38-108) to implement `PartialEq`, `Eq`, and `Hash` traits when `extra_traits` feature is enabled. Custom implementations handle array comparisons using iterator-based element-wise equality checking.

**Architecture Constants (L110-116):**
- `_ALIGNBYTES`: Memory alignment constant based on `c_longlong` size
- `BIOCSRTIMEOUT`/`BIOCGRTIMEOUT`: Berkeley Packet Filter timeout ioctl constants
- `MAP_32BIT`: Memory mapping flag for 32-bit address space
- `MINSIGSTKSZ = 4096`: Minimum signal stack size
- `TIOCTIMESTAMP`: TTY timestamp ioctl constant

**Dependencies:**
- `crate::prelude::*`: Core libc types (`c_int`, `c_long`, etc.)
- `s_no_extra_traits!` macro: Conditionally excludes derive traits
- `cfg_if!` macro: Feature-conditional compilation

**Architectural Notes:**
RISC-V specific register layout matches hardware specification with 7 temporary registers, 12 saved registers, and 8 argument registers. Floating-point registers stored as pairs of 64-bit values for 128-bit quad precision support.