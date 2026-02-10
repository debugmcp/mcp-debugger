# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd11/mod.rs
@source-hash: 16595db5aaf422e4
@generated: 2026-02-09T17:58:12Z

**Purpose**: FreeBSD 11-specific type definitions and function bindings for the libc crate, providing backward compatibility for APIs that changed in FreeBSD 12+.

**Core Responsibility**: Maintains FreeBSD 11 ABI compatibility by defining older type sizes and function signatures that were modified in later FreeBSD versions.

## Key Type Definitions

**Primitive Types (L6-10)**: Version-specific type aliases that changed in FreeBSD 12:
- `nlink_t = u16` (changed from u16 to u64 in FreeBSD 12)
- `dev_t = u32` (changed from u32 to u64 in FreeBSD 12) 
- `ino_t = u32` (changed from u32 to u64 in FreeBSD 12)

**Core Structures**:
- `kevent` (L13-20): Kernel event structure for kqueue operations
- `shmid_ds` (L22-33): Shared memory segment descriptor with FreeBSD 11-specific field types
- `kinfo_proc` (L35-212): Comprehensive process information structure with 50+ fields for system introspection
- `dirent` (L216-223): Directory entry with FreeBSD 11-specific `d_namlen` type (u8)
- `statfs` (L225-250): Filesystem statistics with shorter path arrays (88 chars vs 1024 in FreeBSD 12)
- `vnstat` (L252-261): Virtual node statistics structure

## Architecture Patterns

**Conditional Compilation**: Uses `cfg_if!` macro (L264, L441) to:
- Conditionally implement `PartialEq`, `Eq`, and `Hash` traits when `extra_traits` feature is enabled
- Include architecture-specific modules (`b64`/`b32`) based on pointer width

**Memory Layout Macros**:
- `s!` macro (L12): Defines structs with automatic trait derivation
- `s_no_extra_traits!` macro (L215): Defines structs without automatic trait derivation
- `safe_f!` macro (L387): Defines safe const functions

## Function Bindings (L403-439)

**FreeBSD 11-Specific Signatures**: External C functions with signatures that changed in FreeBSD 12:
- `setgrent()` returns `c_int` (removed return value in FreeBSD 12)
- `mprotect()` takes `*const c_void` addr (changed to `*mut c_void` in FreeBSD 12)
- `freelocale()` returns `c_int` (removed return value in FreeBSD 12)
- `msgrcv()` returns `c_int` (changed to `ssize_t` in FreeBSD 12)
- `qsort_r()` uses versioned symbol `@FBSD_1.0` for pre-FreeBSD 14 argument order

**Device Utilities (L388-400)**: Safe const functions for device number manipulation:
- `makedev()`: Combines major/minor numbers into device ID
- `major()`/`minor()`: Extract components from device ID

## Constants (L380-385)
- `ELAST = 96`: Last errno value
- `RAND_MAX = 0x7fff_fffd`: Maximum random number
- `KI_NSPARE_PTR = 6`: kinfo_proc spare pointer count
- `SPECNAMELEN = 63`: Maximum device name length

## Dependencies
- Imports `crate::prelude::*` for common libc types
- References numerous crate-level types (pid_t, uid_t, gid_t, etc.)
- Conditionally includes architecture-specific submodules