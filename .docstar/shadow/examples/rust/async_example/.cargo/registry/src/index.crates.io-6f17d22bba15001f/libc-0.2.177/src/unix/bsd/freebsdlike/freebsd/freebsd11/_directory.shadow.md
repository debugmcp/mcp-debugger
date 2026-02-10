# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd11/
@generated: 2026-02-09T18:16:06Z

## FreeBSD 11 Compatibility Module

This directory provides FreeBSD 11-specific implementations within the libc crate's Unix BSD hierarchy, serving as a backward compatibility layer for applications targeting FreeBSD 11 systems.

### Overall Purpose

The module bridges API differences between FreeBSD 11 and newer versions by maintaining the exact type sizes, structure layouts, and function signatures that existed in FreeBSD 11. This ensures that code compiled against this libc version can correctly interface with FreeBSD 11 system calls and data structures.

### Key Components and Architecture

**Core Module (mod.rs)**: Central compatibility layer defining FreeBSD 11-specific types and structures
- Type definitions with FreeBSD 11 sizes: `nlink_t` (u16), `dev_t` (u32), `ino_t` (u32) 
- Critical system structures: `kevent`, `shmid_ds`, `kinfo_proc`, `dirent`, `statfs`, `vnstat`
- Function bindings with FreeBSD 11 signatures for `setgrent()`, `mprotect()`, `msgrcv()`, `qsort_r()`
- Device number manipulation utilities: `makedev()`, `major()`, `minor()`

**Architecture-Specific Modules**:
- **b32.rs**: 32-bit `stat` structure layout matching FreeBSD 11's ABI
- **b64.rs**: 64-bit `stat` structure layout matching FreeBSD 11's ABI

Both architecture modules provide C-compatible `stat` structures with comprehensive file metadata including timestamps with nanosecond precision, ownership information, and FreeBSD-specific fields like flags and generation numbers.

### Public API Surface

**Primary Entry Points**:
- Type aliases: `nlink_t`, `dev_t`, `ino_t` for compatibility with FreeBSD 11 sizes
- System structures: `stat`, `kevent`, `shmid_ds`, `kinfo_proc`, `dirent`, `statfs`, `vnstat`
- System functions: `setgrent()`, `mprotect()`, `msgrcv()`, `qsort_r()`
- Utility functions: `makedev()`, `major()`, `minor()` for device number manipulation

**Architecture Selection**: Conditional compilation automatically selects appropriate `stat` structure (32-bit or 64-bit) based on target architecture.

### Internal Organization

The module uses a hierarchical conditional compilation strategy:
1. **mod.rs** provides common FreeBSD 11 definitions
2. **b32.rs/b64.rs** provide architecture-specific `stat` structures
3. **cfg_if!** macro selects appropriate architecture module at compile time

All structures use `#[repr(C)]` for C ABI compatibility and implement `Copy`/`Clone` traits with manual implementations to maintain precise memory layout control.

### Data Flow and Integration

- Integrates into libc's Unix → BSD → FreeBSDlike → FreeBSD → FreeBSD11 hierarchy
- Provides drop-in compatibility for applications expecting FreeBSD 11 system interface
- Structures and functions directly interface with FreeBSD 11 system calls
- Type definitions cascade up to parent modules for use throughout the libc crate

### Important Patterns

- **Backward Compatibility**: Maintains exact FreeBSD 11 type sizes and layouts that changed in FreeBSD 12+
- **ABI Safety**: All public structures use `#[repr(C)]` and manual trait implementations
- **Conditional Compilation**: Architecture-specific code isolation while maintaining unified API
- **Feature-Gated Traits**: Optional `PartialEq`, `Eq`, and `Hash` implementations via `extra_traits` feature