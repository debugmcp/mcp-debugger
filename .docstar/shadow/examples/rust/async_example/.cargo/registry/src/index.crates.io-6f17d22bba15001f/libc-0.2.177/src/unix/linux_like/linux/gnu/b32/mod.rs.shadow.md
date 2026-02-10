# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/mod.rs
@source-hash: 050fa9856b151b3e
@generated: 2026-02-09T17:56:59Z

**32-bit GNU Linux Type Definitions Module**

This module provides platform-specific type definitions and constants for 32-bit GNU Linux systems, handling complex feature flag combinations and architecture-specific variations. It serves as a foundational layer in the libc crate's Linux compatibility hierarchy.

**Core Type Definitions (L6-70)**
- **Basic Types (L6-18)**: Standard C types (`clock_t`, `shmatt_t`, `msgqnum_t`, etc.) with 32-bit specific sizing
- **Feature-Conditional Types (L20-70)**: Complex cfg_if! block defining time/file types based on:
  - `target_arch = "riscv32"`: 64-bit time_t, off_t, modern types (L21-32)
  - `gnu_time_bits64`: 64-bit time_t with mixed sizing (L33-44) 
  - `gnu_file_offset_bits64`: 32-bit time_t with 64-bit file offsets (L45-56)
  - Default: Traditional 32-bit types (L57-69)

**System Structures (L72-286)**
- **stat Structure (L79-126)**: File metadata with conditional fields based on gnu_time_bits64/gnu_file_offset_bits64 flags, excluding specific architectures (mips, powerpc, sparc)
- **statvfs (L131-145)**: Filesystem statistics structure
- **pthread_attr_t (L147-149)**: POSIX thread attributes (36 bytes on 32-bit)
- **sigset_t (L151-153)**: Signal set representation (128 bytes)
- **sysinfo (L155-174)**: System information with deprecated padding field
- **semid_ds (L176-212)**: Semaphore set metadata with complex conditional padding
- **timex Structures (L214-285)**: Time adjustment structures with separate 64-bit (L215-250) and 32-bit (L253-285) variants

**Constants and Architecture Branching**
- **File Operations (L288-408)**: POSIX file advice, OFD locks, and architecture-specific constants
- **SPARC vs Others (L303-390)**: Major conditional split defining different values for file flags, signals, and error codes
- **Lock Constants (L391-408)**: File locking constants varying by architecture and feature flags
- **Pthread Initializers (L410-445)**: Endian-specific mutex initializer constants
- **System Call Constants (L447-461)**: ptrace operations and sysctl function declaration

**Architecture Module Loading (L463-491)**
Conditional module imports for specific 32-bit architectures: x86, arm, mips variants, m68k, powerpc, sparc, riscv32, and csky.

**Dependencies**
- Uses `crate::prelude::*` and `crate::pthread_mutex_t`
- Relies on cfg_if! macro for conditional compilation
- References parent crate types (dev_t, ino_t, mode_t, etc.)

**Critical Design Patterns**
- Extensive use of feature flags (`gnu_time_bits64`, `gnu_file_offset_bits64`) to handle glibc ABI transitions
- Architecture-specific constant values with fallback defaults
- Conditional struct field inclusion based on multiple intersecting conditions
- Endianness-aware constant definitions for thread synchronization primitives