# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/solarish/
@generated: 2026-02-09T18:16:18Z

## Purpose
Platform-specific system interface definitions for Solarish (Solaris/Illumos) Unix systems within the libc crate. Provides complete FFI bindings, type definitions, constants, and compatibility functions for the Solarish platform family, supporting both Solaris and Illumos variants across x86 and SPARC architectures.

## Key Components and Organization

### Core Module Structure
- **`mod.rs`** - Primary platform module providing foundational Unix system definitions, core data structures (networking, threading, file system), signal handling, and comprehensive FFI function declarations
- **`solaris.rs`** - Solaris-specific extensions including door API, privilege system, and Solaris-variant structures
- **`illumos.rs`** - Illumos-specific bindings with specialized structures (epoll, extended utmpx) and constants
- **`compat.rs`** - Compatibility layer implementing missing system functions (terminal control, pseudo-terminal operations, thread-safe entry retrieval)

### Architecture Support
- **`x86.rs`** - 32-bit x86 ELF definitions and dynamic linker structures
- **`x86_64.rs`** - 64-bit x86 types, FPU state, machine context, and register constants
- **`x86_common.rs`** - Shared x86 hardware capability constants for CPU feature detection

## Public API Surface

### Primary Entry Points
- **System Types**: Core Unix types (`dev_t`, `ino_t`, `mode_t`, etc.) and platform-specific types (`lgrp_*`, door API types)
- **Data Structures**: Complete definitions for networking (`sockaddr`, `in_addr`), threading (`pthread_*`), file system (`stat`, `dirent`), and signal handling (`sigaction`, `siginfo_t`)
- **Constants**: Comprehensive system constants including error codes, file permissions, network options, signal definitions, and hardware capability flags
- **FFI Functions**: Over 600 system call and library function declarations covering process control, memory management, networking, and platform-specific APIs

### Compatibility Functions (compat.rs)
- **Terminal Control**: `cfmakeraw()`, `cfsetspeed()` for terminal configuration
- **Pseudo-terminal**: `openpty()`, `forkpty()` with STREAMS module setup (Illumos only)
- **Thread-safe Lookups**: `getpwent_r()`, `getgrent_r()` wrappers

## Internal Organization and Data Flow

### Platform Differentiation
The module uses conditional compilation (`cfg_if!`) to handle differences between Solaris and Illumos:
- Common definitions in `mod.rs` serve as the foundation
- Platform-specific modules (`solaris.rs`, `illumos.rs`) provide extensions
- Architecture modules (`x86.rs`, `x86_64.rs`) supply hardware-specific types

### Data Structure Hierarchy
1. **Basic Types** → **Core Structures** → **Complex Systems**
2. Primitive type aliases (L3-56 in mod.rs) form the foundation
3. Network, threading, and file system structures build upon basics
4. Platform-specific extensions add specialized functionality

### Signal Handling Architecture
Sophisticated signal system with:
- Core `siginfo_t` structure with platform-specific layout
- Internal signal info structures for different signal types
- Unsafe accessor methods for extracting signal data
- Conditional compilation for different pointer widths

## Important Patterns and Conventions

### Memory Safety
- Extensive use of `unsafe` markers for FFI functions
- Proper error handling patterns with errno preservation
- Resource cleanup helpers (e.g., `bail()` function in compat.rs)
- Buffer size validation to prevent overflow

### Conditional Compilation
- `#[cfg(target_os = "illumos")]` vs `#[cfg(target_os = "solaris")]` for platform variants
- Architecture-specific code paths for x86 vs SPARC64
- Optional trait implementations behind "extra_traits" feature flag

### C Compatibility
- Uses libc crate macros (`s!`, `e!`, `s_no_extra_traits!`) for consistent C structure definitions
- Maintains ABI compatibility with system headers
- Proper alignment and packing for architecture-specific requirements

### Error Handling
- Consistent errno handling patterns throughout compatibility functions
- Early return strategies for error conditions
- Graceful degradation in compatibility layer

## Integration with Larger System
This module serves as the complete system interface layer for Rust programs targeting Solarish platforms. It bridges Rust's type safety with C system APIs while preserving platform-specific behaviors and optimizations. The module enables portable Unix programming while providing access to Solaris/Illumos-specific features like doors, processor sets, and locality groups.