# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/apple/b64/aarch64/mod.rs
@source-hash: 897be1845603876b
@generated: 2026-02-09T17:58:06Z

## Primary Purpose
Platform-specific definitions for Apple's ARM64 (AArch64) architecture on macOS, providing low-level system types and structures for signal handling, memory management, and CPU context operations.

## Key Types and Structures

**Type Aliases (L3-4):**
- `boolean_t` - Maps to `c_int` for Darwin boolean operations
- `mcontext_t` - Pointer to `__darwin_mcontext64` for machine context representation

**Core Structures:**

**malloc_zone_t (L7-9)** - Memory allocation zone descriptor with private implementation details. Contains 18 pointer-sized fields as opaque storage for zone metadata.

**ucontext_t (L11-18)** - User context structure for signal handling and context switching:
- Signal stack information (`uc_onstack`, `uc_sigmask`, `uc_stack`)
- Context linking (`uc_link`) for nested contexts
- Machine context size and pointer (`uc_mcsize`, `uc_mcontext`)

**__darwin_mcontext64 (L20-24)** - Complete machine context containing three ARM64-specific state structures:
- Exception state (`__es`)
- Thread/CPU register state (`__ss`)  
- NEON/SIMD state (`__ns`)

**__darwin_arm_exception_state64 (L26-30)** - ARM64 exception handling state:
- Fault address register (`__far`)
- Exception syndrome register (`__esr`)
- Exception type (`__exception`)

**__darwin_arm_thread_state64 (L32-40)** - ARM64 CPU register state:
- General purpose registers (`__x[29]`)
- Frame pointer, link register, stack pointer (`__fp`, `__lr`, `__sp`)
- Program counter and status register (`__pc`, `__cpsr`)

**__darwin_arm_neon_state64 (L42-46)** - ARM64 SIMD/floating-point state:
- 32 128-bit NEON vector registers (`__v`)
- Floating-point status/control registers (`__fpsr`, `__fpcr`)

**max_align_t (L50-52)** - Platform maximum alignment type using `f64` for ARM64 alignment requirements.

## Architecture Dependencies
- Imports from `crate::prelude::*` for common libc types
- Uses crate-specific types: `uintptr_t`, `sigset_t`, `stack_t`, `__uint128_t`
- ARM64-specific register layouts and sizes
- Darwin/macOS system call interface compatibility

## Notable Patterns
- Uses `s!` macro for standard struct definitions with extra traits
- Uses `s_no_extra_traits!` macro for `max_align_t` to exclude certain derive implementations
- Consistent `__darwin_` prefixing follows Apple's internal naming conventions
- Opaque `__private` field approach for ABI stability in `malloc_zone_t`