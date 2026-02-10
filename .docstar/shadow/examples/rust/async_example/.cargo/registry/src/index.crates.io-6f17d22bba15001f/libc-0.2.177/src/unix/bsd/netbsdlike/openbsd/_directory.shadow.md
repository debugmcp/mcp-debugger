# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/openbsd/
@generated: 2026-02-09T18:16:17Z

## Purpose
This directory provides OpenBSD-specific platform implementations for the libc crate's Unix BSD family. It contains architecture-specific constants, type definitions, and system structures that enable Rust programs to interact with OpenBSD system APIs across multiple CPU architectures.

## Architecture Organization
The module is organized around a multi-architecture support pattern with a main module (`mod.rs`) providing core OpenBSD functionality and architecture-specific submodules:

### Core Module (mod.rs)
- **Primary API Surface**: Comprehensive OpenBSD system interface including type definitions, structures, constants, and system call bindings
- **System Structures**: Network (`sockaddr_in`, `ip_mreqn`), filesystem (`stat`, `statvfs`), process (`kinfo_proc`), and ELF (`Elf32_Phdr`/`Elf64_Phdr`) structures
- **Signal Handling**: Platform-agnostic `siginfo_t` with unsafe accessor methods for union field access
- **System Calls**: Complete set of OpenBSD-specific system call bindings including `pledge()`, `unveil()`, and `strtonum()`
- **Constants**: Extensive system constants for networking, file operations, kernel configuration, and process control

### Architecture-Specific Modules
Each architecture module provides platform-specific constants and signal context structures:

- **aarch64.rs**: ARM64 signal context (`sigcontext`) with 30 general-purpose registers and ARM64-specific state
- **arm.rs**: ARM memory alignment and page size constants  
- **mips64.rs**: MIPS64 alignment (7 bytes) and page size (16KB) constants
- **powerpc.rs/powerpc64.rs**: PowerPC alignment constants using double/long alignment requirements
- **riscv64.rs**: RISC-V 64-bit signal context with complete register file representation
- **sparc64.rs**: SPARC64 16-byte alignment and 8KB page constants
- **x86.rs**: x86 32-bit alignment and standard 4KB page constants
- **x86_64.rs**: x86_64 signal context with complete CPU state and floating-point (`fxsave64`) structures

## Key Patterns and Conventions

### Memory Management Constants
All architecture modules provide two critical constants:
- `_ALIGNBYTES`: Platform-specific memory alignment boundaries (calculated from native type sizes)
- `_MAX_PAGE_SHIFT`: Page size shift values (typically 12 for 4KB, varies by architecture)

### Signal Context Structures
Architecture-specific signal context structures (`sigcontext`) that:
- Map directly to kernel-provided CPU state during signal delivery
- Include all general-purpose registers, special registers, and floating-point state
- Provide security cookies for stack protection
- Are aliased as `ucontext_t` for POSIX compatibility

### Safety Model
- Uses `unsafe` accessor methods for union-like structures (e.g., `siginfo_t`)
- Employs `s!` and `s_no_extra_traits!` macros for structure definitions
- Provides conditional trait implementations behind feature gates
- Handles packed structures with special alignment considerations

## Public API Entry Points

### Primary Interface (mod.rs)
- **Type Definitions**: Core OpenBSD types (`clock_t`, `dev_t`, `sigset_t`, etc.)
- **System Structures**: All major system structures for networking, filesystem, and process management
- **System Call Bindings**: Complete set of external C function declarations
- **Constants**: Comprehensive system constants for all OpenBSD subsystems

### Architecture Selection
- Conditional compilation selects appropriate architecture module based on target
- Each architecture contributes platform-specific constants and signal handling structures
- Architecture modules are automatically included via `cfg_if!` macro patterns

## Internal Organization

### Hierarchical Inheritance
Positioned as `unix::bsd::netbsdlike::openbsd`, inheriting from:
- Unix foundation layer (basic POSIX types)
- BSD extensions (BSD-specific structures and constants) 
- NetBSD-like layer (shared NetBSD/OpenBSD functionality)
- OpenBSD specifics (this module)

### Data Flow
1. Architecture detection determines which submodule constants are used
2. Core `mod.rs` provides the main API surface with OpenBSD-specific types and system calls
3. Architecture modules contribute platform-specific alignment, paging, and signal context definitions
4. Combined interface provides complete OpenBSD system programming capabilities

This module serves as the definitive interface for Rust programs targeting OpenBSD, providing both portable BSD functionality and OpenBSD-specific features like pledge/unveil security mechanisms across all supported CPU architectures.