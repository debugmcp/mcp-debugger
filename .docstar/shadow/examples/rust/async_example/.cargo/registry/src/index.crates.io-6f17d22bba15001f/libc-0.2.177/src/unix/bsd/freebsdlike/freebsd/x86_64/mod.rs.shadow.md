# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/x86_64/mod.rs
@source-hash: b79601d4f5f297f2
@generated: 2026-02-09T17:57:04Z

## FreeBSD x86_64 Architecture-Specific Type Definitions and Low-Level System Structures

**Primary Purpose**: Defines FreeBSD x86_64 architecture-specific type aliases, processor register structures, floating-point units, and system constants for low-level system programming and FFI bindings.

### Core Type Aliases (L3-7)
- `clock_t`, `wchar_t` → i32 primitives
- `time_t`, `suseconds_t`, `register_t` → i64 primitives for 64-bit time and register values

### CPU Register Structures
- **`reg32` (L10-30)**: 32-bit x86 register context with general-purpose registers (eax, ebx, etc.), segment registers (fs, es, ds, gs), stack pointers, and trap information
- **`reg` (L32-59)**: 64-bit x86_64 register context with extended registers (r8-r15), 64-bit general-purpose registers (rax, rbx, etc.), and mixed-width segment/control registers

### Floating-Point and Extended Processor State
- **`fpreg32` (L63-68)**: 32-bit FPU state with environment, accumulator arrays, and padding
- **`fpreg` (L70-75)**: 64-bit FPU state with extended accumulator and spare fields
- **`xmmreg` (L77-82)**: XMM/SSE register state with environment, accumulator, and register arrays

### ELF and System Context Structures
- **`__c_anonymous_elf64_auxv_union` (L84-88)**: Union for ELF auxiliary vector values (integer, pointer, or function)
- **`Elf64_Auxinfo` (L90-93)**: ELF auxiliary information structure
- **`max_align_t` (L95-98)**: 16-byte aligned type for maximum alignment requirements
- **`mcontext_t` (L102-148)**: Machine context for signal handling and thread switching, with FreeBSD version-specific conditional compilation for `mc_spare` vs `mc_tlsbase` fields

### Trait Implementations (L151-324)
Conditional `PartialEq`, `Eq`, and `Hash` implementations for all complex structures when `extra_traits` feature is enabled. Notable implementation details:
- Union comparison uses unsafe code with OR logic for all variants (L217-225)
- Array comparisons use iterator-based element-wise comparison for padding fields

### Architecture Constants (L326-346)
- Memory alignment: `_ALIGNBYTES` based on `c_long` size
- BSD packet filter timeouts: `BIOCSRTIMEOUT`/`BIOCGRTIMEOUT` 
- Memory mapping: `MAP_32BIT` flag, `MINSIGSTKSZ` minimum stack size
- Machine context flags: `_MC_HASSEGS`, `_MC_HASBASES`, `_MC_HASFPXSTATE`
- FPU format/ownership constants: `_MC_FPFMT_*`, `_MC_FPOWNED_*`
- File info size and TTY timestamp ioctl constants

**Key Dependencies**: Relies on `crate::prelude::*` for fundamental types and macros (`s!`, `s_no_extra_traits!`, `cfg_if!`) for conditional compilation.

**Architectural Pattern**: Uses macro-based struct definitions with conditional trait derivation, FreeBSD version-aware conditional compilation, and unsafe union operations for system-level compatibility.