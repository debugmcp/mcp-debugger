# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/newlib/vita/
@generated: 2026-02-09T18:16:13Z

**PlayStation Vita newlib Platform Module**

This directory contains the complete PlayStation Vita (PSVita) platform-specific bindings for the Rust libc crate. It provides low-level system interface definitions tailored to the PSVita's newlib-based C library implementation.

## Overall Purpose

This module serves as the PSVita-specific implementation layer within the Unix newlib family, providing:
- Type definitions and constants matching PSVita's system ABI
- Socket and networking structures with PSVita-specific extensions
- Threading primitives with platform-specific processor affinity support
- File system and I/O operation bindings
- Signal handling and system call interfaces

## Key Components and Organization

**Core Foundation (mod.rs):**
- Basic type aliases (`clock_t`, `wchar_t`, `sigset_t`) establishing PSVita's data model
- Complete set of system structures covering networking, file operations, and threading
- Platform-specific constants with PSVita-tailored values
- External function declarations for system calls and library functions

**Component Integration:**
The module is organized around major system subsystems:
- **Networking Stack:** Socket address families, message structures, and poll operations with PSVita's `vport` extensions
- **File System Interface:** Standard Unix file operations with PSVita-specific directory handling
- **Threading Model:** POSIX threading with PSVita processor affinity extensions
- **System Services:** Signal handling, time management, and secure random number generation

## Public API Surface

**Primary Entry Points:**
- Type definitions for all major system structures (`sockaddr_*`, `stat`, `dirent`, `msghdr`)
- Network programming constants (address families, socket types, poll events)
- File operation flags and system constants
- Threading function declarations with PSVita-specific extensions

**Key Interfaces:**
- Socket programming: `sockaddr_in`/`sockaddr_in6` with `sin_vport`/`sin6_vport` fields
- File I/O: vectored operations (`readv`/`writev`), timestamp control (`futimens`)
- Threading: standard pthread functions plus PSVita processor affinity (`pthread_*processorcpu_np`)
- System utilities: `pipe2`, `getentropy`, message-based socket communication

## PSVita-Specific Adaptations

**Platform Extensions:**
- Socket addresses include PSVita-specific `vport` fields for network virtualization
- Threading system supports PSVita's processor affinity model through `*_processorcpu_np` functions  
- Directory entries use opaque 88-byte offset fields with 8-byte alignment requirements
- Constants are adapted to PSVita's specific system call interface values

**Integration Patterns:**
- Maintains Unix compatibility while extending for PSVita hardware capabilities
- Provides complete newlib interface coverage for cross-compilation targeting PSVita
- Balances standard POSIX semantics with PSVita's gaming console architecture requirements

This module enables Rust applications to interface directly with PSVita system services while maintaining familiar Unix-like semantics for portable code.