# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/haiku/
@generated: 2026-02-09T18:16:17Z

## Purpose
Platform abstraction layer for Haiku OS within Rust's libc crate. This module provides complete system-level bindings enabling Rust code to interact with Haiku's dual API architecture (POSIX compatibility + native BeOS-derived APIs) across both 32-bit and 64-bit platforms.

## Architecture Overview
The module implements a multi-layered approach to Haiku OS support:

- **Core module (`mod.rs`)**: Main platform abstraction with fundamental types, POSIX APIs, and system structures
- **Architecture-specific modules**: `b32.rs`/`b64.rs` for word-size specific type definitions, `x86_64.rs` for CPU context structures  
- **API compatibility layers**: `bsd.rs` for BSD APIs, `native.rs` for Haiku-specific system calls
- **Dual library support**: Links against both `libroot.so` (POSIX/native) and `libbsd.so`/`libgnu.so` (compatibility)

## Key Components

### Type System Foundation
- **Cross-architecture types**: Time representation (`time_t`) adapts to platform (32-bit vs 64-bit)
- **ELF binary support**: Complete ELF32/ELF64 program header definitions for dynamic linking
- **Resource identifiers**: Comprehensive ID types for areas, ports, threads, teams, images
- **Signal handling**: x86_64 CPU context structures for signal delivery and system calls

### API Surface Areas

**POSIX Compatibility Layer**:
- Standard Unix system calls and data structures
- Threading primitives (pthread_mutex_t, pthread_cond_t, pthread_rwlock_t)
- File system operations with Haiku extensions (creation time, attributes)
- Process management with BSD-style wait operations

**BSD Compatibility Layer**:
- kqueue event notification system (kevent structures and functions)
- Pseudo-terminal operations (openpty, forkpty)
- Security utilities (arc4random, explicit_bzero)
- String manipulation extensions

**Native Haiku API**:
- BeOS-derived system calls for areas, ports, semaphores
- Image loading and symbol resolution
- File system queries and attributes
- Media/real-time task scheduling
- CPU topology and system information

### Internal Organization

**Data Flow Pattern**:
1. Architecture detection routes to appropriate word-size module (b32/b64)
2. Core module provides fundamental types and POSIX APIs
3. Compatibility modules (bsd, native) extend with platform-specific functionality
4. CPU-specific modules (x86_64) handle low-level context structures

**Memory Management Integration**:
- Area-based memory management (Haiku's equivalent to mmap)
- ELF program headers for dynamic linking support
- Signal context preservation for userspace/kernel transitions

## Public API Entry Points

### Primary Interfaces
- **Type definitions**: All standard libc types adapted for Haiku (`pid_t`, `pthread_t`, `stat`, etc.)
- **System calls**: Complete POSIX function bindings plus Haiku extensions
- **Constants**: Error codes, flags, and system limits following both POSIX and BeOS conventions
- **Structures**: Network, file system, threading, and IPC data structures

### Platform-Specific Extensions
- **native.rs functions**: `find_area()`, `create_port()`, `load_image()` - core Haiku system calls
- **bsd.rs functions**: `kqueue()`, `kevent()`, `arc4random()` - BSD compatibility layer
- **ELF support**: Dynamic linking structures for both 32-bit and 64-bit architectures

## Integration Patterns
- **Conditional compilation**: Architecture and feature flags route to appropriate implementations
- **C ABI compatibility**: All structures maintain exact C memory layout for FFI
- **Error handling**: Dual error code systems (POSIX positive, BeOS negative) with translation layer
- **Thread safety**: Native Haiku synchronization primitives with POSIX wrappers

## Critical Design Principles
- **API coexistence**: POSIX and native Haiku APIs operate simultaneously without conflicts
- **Zero-cost abstraction**: Direct FFI bindings with no Rust overhead
- **Platform completeness**: Full coverage of Haiku's system capabilities for systems programming
- **Forward compatibility**: Extensible design supporting future Haiku API evolution