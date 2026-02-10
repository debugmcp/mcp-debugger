# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/arch/generic/mod.rs
@source-hash: c8f4d88ba7ffe044
@generated: 2026-02-09T17:58:19Z

## Purpose
This module defines generic Linux system constants and data structures for POSIX-like operations, primarily focused on socket options, terminal I/O control (ioctl), and resource limits. It serves as a platform-agnostic foundation for Linux-like architectures within the libc crate.

## Key Data Structures
- **termios2** (L5-14): Extended terminal I/O structure with additional speed control fields `c_ispeed` and `c_ospeed`, used for advanced serial communication configuration

## Socket Constants (SOL_SOCKET Level)
- **Basic socket options** (L21-51): Standard socket configuration constants including `SOL_SOCKET`, `SO_REUSEADDR`, `SO_TYPE`, etc.
- **Timestamp handling** (L52-86): Conditional compilation logic for time-related socket options based on `linux_time_bits64` feature and target architecture, with special handling for musl/ohos environments
- **Extended socket options** (L88-160): Modern Linux socket features including BPF attachment, memory management, and device memory operations
- **SCM constants** (L162-169): Socket control message types for ancillary data transmission

## Terminal I/O Control (Ioctl)
- **Terminal control** (L172-233): Comprehensive set of ioctl constants for terminal operations including `TCGETS`, `TCSETS`, `TIOCGWINSZ`, etc.
- **Serial port control** (L237-247): Serial port configuration and status ioctl constants
- **Block device** (L248-252): Block device I/O optimization constants
- **Architecture-specific** (L253-259): Conditional `FIOQSIZE` definition for ARM and s390x architectures
- **Modem control** (L261-271): Terminal modem line status constants with aliases (e.g., `TIOCM_CD` = `TIOCM_CAR`)

## Terminal Speed Control
- **Special baud rates** (L273-274): `BOTHER` for custom baud rates and `IBSHIFT` for input speed bit shifting

## Resource Limits
- **Environment-specific limits** (L278-322): Conditional resource limit constants based on target environment (GNU/uClibc vs musl/ohos)
- **Standard RLIMIT types** (L280-295, L300-315): CPU time, file size, memory, process count, etc.
- **Deprecated constants** (L296-298, L316-320, L325-332): Version-unstable limit constants marked as deprecated

## Architectural Decisions
- Uses `cfg_if!` macros extensively for conditional compilation based on target architecture and environment
- Separates time-related socket options based on 64-bit time support and target platform
- Provides environment-specific resource limit types (crate::__rlimit_resource_t vs c_int)
- Maintains backward compatibility with deprecated constants while warning users

## Dependencies
- Imports from `crate::prelude::*` and `crate::Ioctl` type
- References various crate-level type aliases (tcflag_t, cc_t, speed_t, etc.)

## Critical Invariants
- Socket timestamp constants change behavior based on time_bits64 feature flag
- Resource limit constant types vary by target environment
- Some ioctl constants are architecture-dependent (ARM, s390x variations)