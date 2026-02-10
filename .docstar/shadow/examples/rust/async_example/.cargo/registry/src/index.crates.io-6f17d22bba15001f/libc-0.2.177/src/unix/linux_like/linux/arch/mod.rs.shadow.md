# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/arch/mod.rs
@source-hash: 8bc5898b03760a95
@generated: 2026-02-09T17:57:13Z

## Purpose
Architecture-specific module dispatcher for Linux libc bindings. Routes to appropriate platform-specific implementations based on target CPU architecture using conditional compilation.

## Structure
- **cfg_if! macro (L1-20)**: Conditional compilation dispatcher that selects architecture-specific modules
- **MIPS support (L2-9)**: Handles mips, mips32r6, mips64, mips64r6 architectures → `mips` module
- **PowerPC support (L10-12)**: Handles powerpc and powerpc64 architectures → `powerpc` module  
- **SPARC support (L13-15)**: Handles sparc and sparc64 architectures → `sparc` module
- **Generic fallback (L16-18)**: Default case for all other architectures → `generic` module

## Pattern
Uses the cfg_if crate's conditional compilation pattern to create a single entry point that branches to architecture-specific implementations. Each branch imports and re-exports all items from the selected module using glob imports (`pub use self::*;`).

## Dependencies
- `cfg_if` macro for clean conditional compilation
- Architecture-specific submodules: `mips`, `powerpc`, `sparc`, `generic`

## Context
Part of the libc crate's Linux-specific bindings, sitting in the architecture layer of the module hierarchy (`unix/linux_like/linux/arch/`). Enables platform-specific optimizations and definitions while maintaining a unified interface.