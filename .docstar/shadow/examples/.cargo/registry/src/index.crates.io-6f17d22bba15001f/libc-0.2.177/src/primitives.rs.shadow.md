# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/primitives.rs
@source-hash: ea7e28520f5f3991
@generated: 2026-02-09T18:11:32Z

## Primary Purpose
Platform-specific C type aliases for FFI compatibility in Rust. Maps C primitive types to appropriate Rust equivalents based on target architecture, operating system, and pointer width.

## Core Type Definitions

### Fixed-Size Types (L9-18)
- `c_schar`, `c_uchar` (L9-10): Signed/unsigned char → i8/u8
- `c_short`, `c_ushort` (L11-12): Short integers → i16/u16
- `c_longlong`, `c_ulonglong` (L14-15): Long long integers → i64/u64
- `c_float`, `c_double` (L17-18): Floating point → f32/f64

### Platform-Conditional Types

**Character Type (L20-44)**
- `c_char` maps to u8 on specific non-Windows, non-Apple architectures (ARM, AArch64, RISC-V, PowerPC, etc.)
- `c_char` maps to i8 on all other targets
- Uses complex cfg condition targeting embedded and specific architectures

**Integer Types (L46-54)**
- `c_int`, `c_uint` → i16/u16 on AVR and MSP430 (16-bit targets)
- `c_int`, `c_uint` → i32/u32 on all other targets

**Long Types (L56-65)**
- `c_long`, `c_ulong` → i64/u64 on 64-bit non-Windows systems
- `c_long`, `c_ulong` → i32/u32 everywhere else (Windows, 32-bit systems)

### Deprecated Fixed-Width Aliases (L67-82)
- Legacy C99 stdint types: `int8_t`, `int16_t`, `int32_t`, `int64_t`
- Unsigned variants: `uint8_t`, `uint16_t`, `uint32_t`, `uint64_t`
- All deprecated since libc 0.2.55, recommend direct Rust types

### GCC Extension Types (L84-95)
- `__int128`, `__uint128` (L87-89): 128-bit integers for AArch64 non-Windows
- `__int128_t`, `__uint128_t` (L91-93): Alternate names for above types
- Only available on specific 64-bit platforms with GCC ABI compatibility

## Key Dependencies
- `cfg_if!` macro for conditional compilation
- Rust core types (i8, u8, i16, u16, i32, u32, i64, u64, f32, f64, i128, u128)

## Architectural Notes
- Follows C ABI specifications for different platforms
- Handles signedness variations of char across architectures
- Accommodates pointer width differences (32-bit vs 64-bit)
- Provides compatibility layer for legacy C code integration
- Based on rust-lang/rust core FFI primitives