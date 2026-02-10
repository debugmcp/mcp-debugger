# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/loongarch64/
@generated: 2026-02-09T18:16:05Z

## Purpose

This directory provides the complete system-level interface layer for LoongArch 64-bit architecture on Linux systems using musl libc. It serves as the foundational ABI compatibility layer between Rust code and the Linux kernel, defining all necessary types, constants, and system call interfaces specific to the LoongArch64 architecture.

## Key Components

**Architecture-Specific Type System:**
- Fundamental C-compatible types (`wchar_t`, `nlink_t`, `blksize_t`) tailored for LoongArch64
- File system structures (`stat`, `stat64`) with proper alignment and field ordering
- IPC permission structures for inter-process communication
- CPU context structures (`user_regs_struct`, `user_fp_struct`) for debugging and signal handling

**System Call Interface:**
- Complete mapping of Linux system calls to numeric identifiers (400+ syscalls)
- Coverage spans traditional operations (I/O, process management) to modern kernel features (io_uring, pidfd, landlock)
- Architecture-specific calling conventions and parameter handling

**Platform Constants:**
- File operation flags and modes
- Signal handling constants and stack configurations  
- Memory management flags including LoongArch64-specific mmap options
- Terminal I/O control definitions with baud rates up to 4Mbps
- POSIX error codes with architecture-appropriate values

## Public API Surface

The module exports a comprehensive set of low-level primitives through `mod.rs`:

**Core Types:** Basic C-compatible types and file system structures
**System Calls:** Complete syscall number enumeration for kernel interface
**Constants:** Platform-specific flags, limits, and configuration values
**Context Structures:** CPU and floating-point register layouts for signal/debug operations

## Internal Organization

The directory follows a single-file architecture where `mod.rs` contains all definitions in logical groupings:
1. Type definitions (basic types → complex structures)
2. System call mappings (organized by functional area)
3. Constant definitions (grouped by subsystem: files, signals, memory, terminal I/O)

## Data Flow and Usage Patterns

This module sits at the bottom of the libc abstraction stack, providing:
- **Upward Interface:** Types and constants consumed by higher-level libc functions
- **Downward Interface:** Direct kernel ABI compatibility for system calls
- **Cross-cutting Concerns:** Architecture-specific alignment, padding, and calling conventions

## Critical Architecture Notes

All structures maintain exact binary compatibility with the Linux kernel ABI for LoongArch64. The 16-byte alignment requirements, register layouts, and field ordering are precisely matched to kernel expectations, making this module essential for any direct system interaction on LoongArch64 platforms.