# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd11/
@generated: 2026-02-09T18:16:07Z

## Purpose

This directory provides FreeBSD 11-specific type definitions and system interfaces for the libc crate, maintaining backward compatibility for APIs and data structures that changed in FreeBSD 12+. It serves as a platform-specific compatibility layer in the hierarchical abstraction: unix → bsd → freebsdlike → freebsd → freebsd11.

## Core Responsibility

Preserves FreeBSD 11 ABI compatibility by defining legacy type sizes, function signatures, and structure layouts that were modified in later FreeBSD versions. This enables applications built against FreeBSD 11 to continue functioning without recompilation.

## Architecture Organization

**Multi-Architecture Support:**
- `mod.rs` - Main module with shared FreeBSD 11 definitions
- `b32.rs` - 32-bit architecture-specific stat structure
- `b64.rs` - 64-bit architecture-specific stat structure
- Conditional compilation selects appropriate architecture module based on pointer width

**Key Version Differences Addressed:**
- Type size changes: `nlink_t` (u16→u64), `dev_t` (u32→u64), `ino_t` (u32→u64)
- Function signature modifications: `setgrent()`, `mprotect()`, `freelocale()`, `msgrcv()`, `qsort_r()`
- Structure layout differences: `statfs` path arrays (88→1024 chars), `dirent` name length field types

## Public API Surface

**Primary Types:**
- **System Structures**: `kevent`, `shmid_ds`, `kinfo_proc`, `dirent`, `statfs`, `vnstat`
- **File Metadata**: Architecture-specific `stat` structures with FreeBSD 11 field layouts
- **Primitive Types**: Version-locked aliases (`nlink_t`, `dev_t`, `ino_t`)

**Function Bindings:**
- Memory protection: `mprotect()` with const pointer signature
- Process/group management: `setgrent()`, `freelocale()` with return values
- Message queues: `msgrcv()` with int return type
- Sorting: `qsort_r()` with pre-FreeBSD 14 argument order (@FBSD_1.0)

**Device Utilities:**
- `makedev()`, `major()`, `minor()` - Safe const functions for device number manipulation

## Data Flow Patterns

**Trait Implementation Strategy:**
- Manual Copy/Clone implementations using bitwise semantics for stat structures
- Conditional trait derivation via `extra_traits` feature flag for Debug, Eq, Hash, PartialEq
- `#[repr(C)]` layout guarantees for all system structures

**Cross-Platform Integration:**
- Imports common libc types from crate prelude
- Provides FreeBSD 11-specific overrides for types that evolved
- Integrates with broader BSD family hierarchy while maintaining version-specific behaviors

## Critical Constraints

**ABI Compatibility**: All structures and function signatures must exactly match FreeBSD 11 system headers to ensure proper kernel interface operation. Field ordering, sizes, and padding are strictly preserved.

**Version Isolation**: This module specifically targets FreeBSD 11 behavior, with later FreeBSD versions handled by sibling modules. Changes here affect only FreeBSD 11 compatibility.