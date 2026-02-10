# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/vxworks/
@generated: 2026-02-09T18:16:10Z

## Overall Purpose

This directory provides comprehensive VxWorks real-time operating system support for the Rust libc crate. It implements a complete C library interface layer that bridges Rust code with VxWorks system services, POSIX-compatible APIs, and platform-specific functionality across multiple hardware architectures.

## Architecture Overview

The module follows a hierarchical architecture-specific design:

- **Core Module (`mod.rs`)**: Contains the main VxWorks C library bindings, including comprehensive type definitions, data structures, constants, and function declarations that provide POSIX-compatible and VxWorks-specific APIs
- **Architecture-Specific Files**: Individual `.rs` files for each supported architecture (aarch64, arm, powerpc, powerpc64, riscv32, riscv64, x86, x86_64) that provide platform-specific type overrides

## Key Components and Relationships

### Primary Interface Layer (`mod.rs`)
- **System Types**: Standard C types (`pid_t`, `uid_t`, `time_t`) and VxWorks-specific types (`TASK_ID`, `RTP_ID`, `SEM_ID`)
- **Threading Primitives**: Complete pthread API with mutexes, condition variables, and rwlocks
- **Network Structures**: BSD socket interface with `sockaddr` family and address resolution
- **File System Interface**: POSIX file operations and metadata structures
- **Signal Handling**: POSIX signal management with VxWorks extensions
- **Function Bindings**: 800+ external function declarations covering standard C library, system calls, and VxWorks-specific APIs

### Architecture-Specific Type Definitions
Each architecture file provides platform-specific overrides, primarily for:
- **`wchar_t` definitions**: 
  - `u32` on: aarch64, arm, powerpc, powerpc64
  - `i32` on: riscv32, riscv64, x86, x86_64
- **Platform ABI compliance**: Ensures binary compatibility with VxWorks system libraries

## Public API Surface

### Main Entry Points
- **Type Definitions**: All standard C and POSIX types (`size_t`, `pid_t`, `pthread_mutex_t`, etc.)
- **System Constants**: Error codes, file descriptor constants, signal numbers, socket options
- **Function Bindings**: Complete C library interface including:
  - File I/O: `open`, `read`, `write`, `stat`, `ftruncate`
  - Process management: `fork`, `exec`, `wait`, `getpid`
  - Threading: Full pthread API
  - Networking: BSD socket interface
  - VxWorks-specific: `taskDelay`, `rtpSpawn`, real-time extensions

### Conditional Features
- **`extra_traits` feature**: Enables Hash, PartialEq, Eq implementations for union types
- **Architecture detection**: Automatic inclusion of appropriate architecture-specific definitions

## Internal Organization and Data Flow

1. **Compilation Flow**: Target detection → architecture-specific module inclusion → type override application
2. **Type Resolution**: Generic types from `mod.rs` → architecture-specific overrides → final platform types
3. **API Layering**: Raw C bindings → Rust-safe wrappers (in consuming crates) → application code

## Important Patterns and Conventions

- **Opaque Types**: Uses empty enums (`DIR`, `FILE`, `_Vx_semaphore`) to prevent direct construction of C structures
- **Static Initializers**: Thread-safe initialization constants using `null_mut()`
- **Extern C Blocks**: Extensive use for C ABI compatibility
- **Conditional Compilation**: Platform-specific code inclusion based on target architecture
- **Union Safety**: Careful trait implementation gating behind feature flags

## Integration Context

This module serves as the foundation for all VxWorks-based Rust applications, providing the essential C library interface layer that enables:
- System-level programming on VxWorks RTOS
- Cross-platform code portability
- FFI compatibility with existing VxWorks C libraries
- Support for embedded and real-time applications across multiple hardware architectures