# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/apple/b64/x86_64/mod.rs
@source-hash: 889efaf7baeca8ba
@generated: 2026-02-09T17:58:12Z

**macOS x86_64 System Types and Memory Management**

This module defines low-level system types and structures for macOS x86_64 architecture, providing FFI bindings for Unix context switching, CPU state management, and memory allocation zones.

## Key Type Definitions

**Basic Types (L3-4):**
- `boolean_t`: C unsigned int type alias
- `mcontext_t`: Pointer to Darwin 64-bit machine context

## Core Structures

**Context Management (L7-14):**
- `ucontext_t`: Unix execution context containing signal mask, stack info, and machine context
  - Links to other contexts via `uc_link`
  - References machine context through `uc_mcontext`

**CPU State Structures (L16-51):**
- `__darwin_mcontext64`: Complete 64-bit machine context with exception, thread, and float state
- `__darwin_x86_exception_state64`: Exception handling state (trap info, fault addresses)
- `__darwin_x86_thread_state64`: Complete x86_64 register set (all general-purpose registers, instruction pointer, flags)

**Floating Point State (L53-106):**
- `__darwin_x86_float_state64`: x87 FPU and SSE state
  - Contains FPU control/status words, MMX registers (stmm0-7), XMM registers (xmm0-15)
  - Note: `__fpu_rsrv4` uses u32[24] instead of u8[96] for trait auto-implementation
- `__darwin_mmst_reg`: MMX/x87 register format
- `__darwin_xmm_reg`: 128-bit XMM register format

**Memory Management (L108-171):**
- `malloc_introspection_t`: Private malloc zone introspection interface
- `malloc_zone_t`: Complete malloc zone structure with function pointers for:
  - Basic operations: malloc, calloc, realloc, free
  - Advanced features: batch operations, alignment, pressure relief
  - Zone management: destroy, introspection, claimed address checking

**Alignment Support (L175-178):**
- `max_align_t`: 16-byte aligned type for maximum alignment requirements

## Architecture Notes

- All structures use Darwin-specific naming conventions with double underscores
- CPU state structures provide complete x86_64 register access for context switching
- Memory zone structure supports advanced malloc implementations with custom allocators
- Mixed visibility: some fields private (`__fpu_fcw`, `_reserved1`) while others public

## Dependencies

- Imports from `crate::prelude::*` for common C types
- References `crate::sigset_t`, `crate::stack_t`, `crate::ucontext_t` for Unix primitives