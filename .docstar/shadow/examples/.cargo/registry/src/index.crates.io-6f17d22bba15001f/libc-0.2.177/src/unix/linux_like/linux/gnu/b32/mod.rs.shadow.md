# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/mod.rs
@source-hash: 050fa9856b151b3e
@generated: 2026-02-09T17:58:20Z

## Purpose
Platform-specific 32-bit GNU libc type definitions and constants for Linux-like systems. This module provides the foundational C FFI types and structures required for system calls on 32-bit GNU/Linux platforms.

## Dependencies
- **crate::prelude** (L3): Core libc preludes  
- **crate::pthread_mutex_t** (L4): pthread mutex type definition

## Type Definitions

### Basic Types (L6-18)
- `clock_t` → `i32`: Process CPU time counter
- `shmatt_t`, `msgqnum_t`, `msglen_t` → `c_ulong`: IPC-related counters
- `nlink_t` → `u32`: File link counter
- `__u64`, `__s64` → 64-bit integer types for kernel interface
- `__fsword_t` → `i32`: Filesystem word type
- `fsblkcnt64_t`, `fsfilcnt64_t` → `u64`: 64-bit filesystem counters

### Architecture-Dependent Types (L20-70)
Complex conditional compilation based on:
- **RISC-V 32-bit** (L21-32): Uses 64-bit time_t, off_t, and related types
- **64-bit time support** (L33-44): gnu_time_bits64 feature
- **Large file support** (L45-56): gnu_file_offset_bits64 feature  
- **Default 32-bit** (L57-69): Traditional 32-bit types

Key varying types: `time_t`, `suseconds_t`, `ino_t`, `off_t`, `blkcnt_t`, `fsblkcnt_t`, `fsfilcnt_t`, `rlim_t`, `blksize_t`

## Structures

### File System Stat (L80-125)
`stat` struct with conditional fields based on:
- Architecture exclusions (not mips/powerpc/sparc)
- Time representation (gnu_time_bits64)  
- File offset size (gnu_file_offset_bits64)

### Core System Structures (L130-286)
- **statvfs** (L131-145): Filesystem statistics
- **pthread_attr_t** (L147-149): Thread attributes (9×u32 array)
- **sigset_t** (L151-153): Signal set (32×c_ulong array)
- **sysinfo** (L155-174): System information with deprecated pad field
- **semid_ds** (L176-212): Semaphore set data structure
- **timex** (L214-285): Time adjustment structure (two variants based on gnu_time_bits64)

## Constants

### File Operations (L288-293)
- POSIX advisory flags and OFD lock commands

### pthread Sizes (L295-301)
Sizeof constants for pthread objects (condattr, mutex, rwlock, barrier, etc.)

### Architecture-Specific Constants (L304-390)
Two major variants:
- **SPARC** (L304-346): Unique values for file flags, signals, errors
- **Other architectures** (L347-388): Standard values

### Lock Types (L391-408) 
F_SETLK/F_SETLKW constants varying by architecture and file offset configuration

### pthread Mutex Initializers (L410-445)
Endian-specific byte arrays for recursive, errorcheck, and adaptive mutex types

### ptrace Constants (L447-450)
Register manipulation constants

## External Interface
**sysctl function** (L453-461): System control interface

## Architecture Modules (L463-491)
Conditional inclusion of arch-specific modules: x86, arm, mips, m68k, powerpc, sparc, riscv32, csky

## Key Patterns
- Extensive use of cfg_if! for conditional compilation
- Endianness-aware constant definitions  
- Feature flags (gnu_time_bits64, gnu_file_offset_bits64) driving type selection
- Architecture-specific constant bifurcation (SPARC vs others)