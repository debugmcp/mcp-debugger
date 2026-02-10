# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/solarish/mod.rs
@source-hash: fd370036f3b0a198
@generated: 2026-02-09T18:02:37Z

## Solarish Platform Module - Unix System Definitions

**Primary Purpose:** Core system interface definitions for Solaris/Illumos (solarish) platforms within the libc crate. Provides FFI bindings and type definitions for Unix system calls, data structures, and constants.

**Key Type Definitions:**
- **Basic Types (L3-46):** Core Unix types like `caddr_t`, `clockid_t`, `dev_t`, `ino_t`, `mode_t`, etc. mapping to C primitive types
- **Network Types (L32-46):** Socket-related types including `socklen_t`, `sa_family_t`, `pthread_t`
- **Specialized Types (L47-56):** Locality group types (`lgrp_*`) and POSIX spawn types

**Core Data Structures:**
- **Network Structures (L77-133):** `in_addr`, `ip_mreq`, `sockaddr`, `sockaddr_in6` with proper field layouts
- **Process/User Structures (L134-155):** `passwd`, `ifaddrs` for system user/network information
- **Threading Structures (L189-229):** `pthread_mutex_t`, `pthread_cond_t`, `pthread_rwlock_t` with platform-specific layouts
- **File System Structures (L231-344):** `dirent`, `glob_t`, `stat` with Solaris-specific extensions
- **Signal Structures (L275-558):** `sigset_t`, `sigaction`, `siginfo_t` with complex conditional compilation

**Signal Information Handling (L826-926):**
- Internal signal info structures: `siginfo_fault`, `siginfo_sigcld`, `siginfo_kill`
- `siginfo_t` implementation with unsafe accessor methods for extracting signal data
- Platform-specific signal data size calculations based on pointer width

**System Constants:**
- **Locale Constants (L928-1012):** Language/region formatting constants
- **File System Constants (L1014-1183):** Path limits, file modes, permissions
- **Signal Constants (L1186-1214):** Standard Unix signals with platform values
- **Network Constants (L1536-1687):** Address families, socket options, IP protocols
- **Error Codes (L1292-1414):** Comprehensive errno definitions

**FFI Function Declarations (L2509-3146):**
- **System Calls:** Standard Unix functions like `getrlimit`, `clock_gettime`, `pthread_create`
- **Platform Extensions:** Solarish-specific functions like `ucred_get`, `pset_create`, `lgrp_init`
- **Memory Management:** `mprotect`, `madvise`, `mmapobj` functions
- **Process Control:** POSIX spawn family, scheduling, and processor binding

**Architecture Handling:**
- Conditional compilation for SPARC64 vs other architectures (L2381-2384)
- Platform-specific structure layouts and alignment requirements
- Pointer width dependent constants (FD_SETSIZE at L1082-1087)

**Key Macros/Functions (L2401-2507):**
- `CMSG_*` family for socket control messages with proper alignment
- `FD_*` family for file descriptor set manipulation
- Signal status checking macros (`WIFEXITED`, `WTERMSIG`, etc.)

**Conditional Platform Support:**
- Illumos vs Solaris specific differences handled via cfg_if (L3216-3226)
- Architecture-specific modules imported for x86/x86_64 (L3228-3240)

This module serves as the foundational layer for all Unix system interactions on Solarish platforms, providing type-safe Rust bindings to C system interfaces while preserving platform-specific behaviors and optimizations.