# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/arm.rs
@source-hash: 6e938534090f8504
@generated: 2026-02-09T17:57:11Z

**Purpose:** ARM-specific type definitions and constants for FreeBSD libc bindings. Part of the libc crate's platform abstraction layer, providing ARM architecture-specific implementations for FreeBSD systems.

**Key Type Definitions (L3-9):**
- `clock_t`, `wchar_t`, `time_t`, `suseconds_t`, `register_t` - Standard C types with ARM-specific sizes
- `__greg_t` (L8) - General register type (c_uint)  
- `__gregset_t` (L9) - Array of 17 general registers for ARM context switching

**Core Structure:**
- `mcontext_t` (L12-18) - Machine context structure for ARM signal handling and context switching
  - `__gregs`: General purpose registers
  - `mc_vfp_size`, `mc_vfp_ptr`: VFP (Vector Floating Point) state management
  - `mc_spare`: Reserved space for future extensions (33 c_uint elements)

**Conditional Trait Implementations (L20-44):**
- Feature-gated extra traits via `cfg_if!` macro
- `PartialEq` (L22-33): Compares all fields including array iteration for mc_spare
- `Eq` and `Hash` (L34-42): Standard derive-equivalent implementations
- Uses `s_no_extra_traits!` macro (L11) for conditional trait exclusion

**Constants:**
- `_ALIGNBYTES` (L46): Internal alignment constant (c_int size - 1)
- Berkeley Packet Filter timeouts: `BIOCSRTIMEOUT`, `BIOCGRTIMEOUT` (L48-49)
- Memory mapping: `MAP_32BIT` flag (L51)
- Signal handling: `MINSIGSTKSZ` minimum stack size (L52), `TIOCTIMESTAMP` ioctl (L53)

**Dependencies:**
- `crate::prelude::*` for common libc types and macros
- Relies on parent module's type definitions (`crate::__greg_t`)

**Architecture Notes:**
- ARM-specific 32-bit register model (17 registers in gregset)
- VFP floating-point unit support in context structure
- 32-bit address space mapping support