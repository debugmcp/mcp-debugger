# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/nto/aarch64.rs
@source-hash: 73ad54ebca13454a
@generated: 2026-02-09T18:02:19Z

## Primary Purpose
Architecture-specific type definitions for QNX Neutrino (NTO) on AArch64 (ARM64) systems. This file provides C ABI-compatible data structures for low-level system programming, particularly for signal handling and processor state management.

## Key Type Definitions

**Basic Types (L3-4):**
- `wchar_t = u32` - Wide character type for Unicode support
- `time_t = i64` - Time representation type (64-bit signed)

**AArch64 Register Structures:**
- `aarch64_qreg_t` (L7-10) - 128-bit SIMD register representation with low/high 64-bit halves
- `aarch64_fpu_registers` (L12-16) - Complete floating-point unit state including 32 SIMD registers, status register (fpsr), and control register (fpcr)
- `aarch64_cpu_registers` (L18-22) - CPU general-purpose registers (32 x 64-bit), exception link register (elr), and processor state (pstate)

**System Context Structures:**
- `mcontext_t` (L24-28) - Machine context for signal handling, 16-byte aligned, containing complete CPU and FPU state
- `stack_t` (L30-34) - Signal stack descriptor with pointer, size, and flags

## Dependencies
- `crate::prelude::*` - Core libc types and macros
- References to `crate::aarch64_*` types indicate cross-module type sharing

## Architectural Notes
- Uses `s!` macro for structure definitions (libc convention for C-compatible structs)
- `#[repr(align(16))]` on `mcontext_t` ensures proper memory alignment for SIMD operations
- Structure layout matches QNX Neutrino ABI requirements for signal handling and context switching