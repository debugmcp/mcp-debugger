# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/apple/b64/x86_64/mod.rs
@source-hash: 889efaf7baeca8ba
@generated: 2026-02-09T17:56:58Z

## Purpose
Platform-specific low-level type definitions for x86_64 Darwin (macOS) systems. Provides FFI bindings for system context structures, CPU register states, floating-point state, and memory allocation zones.

## Key Type Definitions

### Context and Signal Handling (L3-14)
- `boolean_t` (L3): Apple boolean type aliased to `c_uint`
- `mcontext_t` (L4): Machine context pointer for signal handling
- `ucontext_t` (L7-14): User context structure containing signal mask, stack info, and machine context

### CPU State Structures (L16-51)
- `__darwin_mcontext64` (L16-20): Complete machine context with exception, thread, and float states
- `__darwin_x86_exception_state64` (L22-27): Exception state including trap info and fault address
- `__darwin_x86_thread_state64` (L29-51): Complete x86_64 register state (RAX through RFLAGS, segment registers)

### Floating-Point State (L53-106)
- `__darwin_x86_float_state64` (L53-97): x87 FPU and SSE state including control words, MMX/SSE registers
- `__darwin_mmst_reg` (L99-102): MMX/x87 register representation (10 bytes + 6 reserved)
- `__darwin_xmm_reg` (L104-106): SSE register representation (16 bytes)

### Memory Management (L108-171)
- `malloc_introspection_t` (L108-110): Private introspection interface (16 pointers)
- `malloc_zone_t` (L114-171): Memory zone structure with function pointers for allocation operations (malloc, free, realloc, etc.)

### Alignment (L174-178)
- `max_align_t` (L176-178): 16-byte aligned type for maximum platform alignment requirements

## Dependencies
- Imports from `crate::prelude::*` for common C types
- References `crate::sigset_t`, `crate::stack_t`, `crate::ucontext_t` from parent modules
- Uses `s!` and `s_no_extra_traits!` macros for struct generation

## Architectural Notes
- Target-specific module for 64-bit x86 Darwin systems
- Maintains binary compatibility with Darwin kernel interfaces
- Private fields in malloc structures indicate unstable ABI
- 16-byte alignment requirement reflects x86_64 SIMD constraints