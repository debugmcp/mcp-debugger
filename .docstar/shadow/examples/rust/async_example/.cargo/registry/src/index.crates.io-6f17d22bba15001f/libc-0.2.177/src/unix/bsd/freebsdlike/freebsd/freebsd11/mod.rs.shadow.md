# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd11/mod.rs
@source-hash: 16595db5aaf422e4
@generated: 2026-02-09T17:57:00Z

## FreeBSD 11 Compatibility Layer for libc

This module provides FreeBSD 11-specific type definitions and API bindings that differ from newer FreeBSD versions, serving as a compatibility layer within the libc crate's Unix BSD hierarchy.

**Primary Purpose:** Maintains backward compatibility with FreeBSD 11 by providing older type sizes and function signatures that changed in FreeBSD 12+.

### Core Type Definitions (L6-10)
- `nlink_t = u16` - Link count type (became u64 in FreeBSD 12)
- `dev_t = u32` - Device identifier type (became u64 in FreeBSD 12) 
- `ino_t = u32` - Inode number type (became u64 in FreeBSD 12)

### Key Structures

**kevent (L13-20)** - Kernel event notification structure for kqueue mechanism
- Contains event identification, filtering, and data fields
- Uses platform-specific pointer and integer types

**shmid_ds (L22-33)** - System V shared memory descriptor
- Notable: `shm_nattch` field remains `c_int` (changed to `shmatt_t` in FreeBSD 12)

**kinfo_proc (L35-212)** - Comprehensive process information structure
- Extensive 60+ field structure for process introspection
- Contains process IDs, resource usage, signal masks, memory statistics
- Critical for system monitoring and debugging tools

**dirent (L216-223)** - Directory entry structure (no extra traits)
- `d_namlen` field is `u8` (became `u16` in FreeBSD 12)
- Fixed 256-byte filename buffer

**statfs (L225-250)** - Filesystem statistics structure
- Path name arrays (`f_mntfromname`, `f_mntonname`) limited to 88 chars (became 1024 in FreeBSD 12)
- Contains filesystem capacity, type, and mount information

**vnstat (L252-261)** - Virtual node statistics for file system objects

### Platform-Specific Code Organization (L441-449)
Uses conditional compilation to include either 32-bit or 64-bit specific implementations via submodules `b32` and `b64`.

### Function Bindings (L403-439)
Provides FreeBSD 11-specific function signatures that changed in later versions:
- `setgrent()` returns `c_int` (return type removed in FreeBSD 12)
- `mprotect()` takes `const void*` (became `void*` in FreeBSD 12)
- `msgrcv()` returns `c_int` (became `ssize_t` in FreeBSD 12)
- `qsort_r()` with FreeBSD 11 argument ordering (changed in FreeBSD 14)

### Helper Functions (L387-401)
Device number manipulation utilities:
- `makedev()` - Combines major/minor into device number
- `major()` - Extracts major device number
- `minor()` - Extracts minor device number

### Trait Implementations (L264-377)
Conditional `PartialEq`, `Eq`, and `Hash` implementations for structures when `extra_traits` feature is enabled, with custom logic for array field comparisons.

**Dependencies:** Relies on parent crate modules for common types (`crate::pid_t`, `crate::uid_t`, etc.) and uses `cfg_if!` macro for conditional compilation.