# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/apple/b64/aarch64/mod.rs
@source-hash: 897be1845603876b
@generated: 2026-02-09T17:56:56Z

## AArch64 Darwin-Specific Types and Structures

This file defines ARM64-specific system types and data structures for macOS/Darwin, serving as the AArch64 architecture layer in the libc crate's BSD/Apple hierarchy.

### Core Type Aliases
- `boolean_t` (L3): C integer type for boolean values on Darwin
- `mcontext_t` (L4): Pointer to Darwin's 64-bit machine context structure

### Key Structures

**Memory Management**
- `malloc_zone_t` (L7-9): Memory zone structure with private implementation details. Uses opaque array of 18 pointers as placeholder pending ARM64 authenticated pointer support.

**Signal/Exception Context**
- `ucontext_t` (L11-18): User context structure for signal handling, containing stack info, signal mask, and machine context
- `__darwin_mcontext64` (L20-24): Complete machine context with exception state, thread state, and NEON vector state

**ARM64 CPU State Components**
- `__darwin_arm_exception_state64` (L26-30): Exception handling state with fault address register (`__far`), exception syndrome (`__esr`), and exception type
- `__darwin_arm_thread_state64` (L32-40): General purpose CPU state including 29 general registers (`__x`), frame pointer (`__fp`), link register (`__lr`), stack pointer (`__sp`), program counter (`__pc`), and processor status (`__cpsr`)
- `__darwin_arm_neon_state64` (L42-46): SIMD/floating-point state with 32 128-bit NEON registers and control registers (`__fpsr`, `__fpcr`)

**Memory Alignment**
- `max_align_t` (L50-52): Maximum alignment type using f64 for proper memory alignment, defined with `s_no_extra_traits!` macro to avoid auto-generated trait implementations

### Dependencies
- Imports from `crate::prelude::*` for common libc types
- References `crate::sigset_t`, `crate::stack_t`, `crate::ucontext_t`, and `crate::__uint128_t`
- Uses libc's structure definition macros (`s!`, `s_no_extra_traits!`)

### Architecture Notes
- Structures mirror Darwin kernel's ARM64 ABI definitions
- Critical for signal handling, context switching, and low-level system programming on Apple Silicon
- Maintains compatibility with Darwin's mach microkernel architecture