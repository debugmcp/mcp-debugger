# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/freebsd12/mod.rs
@source-hash: 8467832d4b8a73e4
@generated: 2026-02-09T17:57:04Z

## Purpose
Platform-specific C bindings for FreeBSD 12, defining system types, structures, constants, and function declarations that changed from FreeBSD 11. Part of the libc crate's hierarchical platform support, providing the updated ABI definitions for FreeBSD 12.

## Key Type Definitions (L6-9)
- `nlink_t = u64`: File link count type (upgraded from 32-bit in FreeBSD 11)
- `dev_t = u64`: Device identifier type (upgraded from 32-bit)
- `ino_t = u64`: Inode number type (upgraded from 32-bit)
- `shmatt_t = c_uint`: Shared memory attachment count type

## Core System Structures

### IPC Structure (L12-21)
- `shmid_ds`: Shared memory segment descriptor with permissions, sizes, PIDs, and timestamps

### Kernel Event Structure (L23-31)
- `kevent`: BSD kqueue event structure for I/O event notification with 64-bit extended data field

### Memory Management (L33-41)
- `kvm_page`: Kernel virtual memory page descriptor with physical/virtual addresses and protection flags

### Process Information (L43-222)
- `kinfo_proc`: Comprehensive process information structure containing:
  - Process identifiers (PID, PPID, session IDs)
  - User/group credentials and permissions
  - Memory usage statistics (virtual, resident, text, data, stack sizes)
  - Signal handling state (masks for pending, ignored, caught signals)
  - Scheduling information (priority, CPU usage, timing)
  - Thread information and kernel addresses
  - String fields for names, login class, emulation type

### File System Structures (L224-256, L271-294)
- `stat`: File metadata structure with FreeBSD 12's expanded 64-bit types and x86-specific timestamp extensions
- `statfs`: File system statistics with version info, block counts, I/O statistics, and mount information

### Directory Operations (L260-269)
- `dirent`: Directory entry with 64-bit inode numbers and 256-character name buffer

### Virtual Node Statistics (L296-305)
- `vnstat`: Virtual file system node statistics for debugging and monitoring

## Trait Implementations (L308-425)
Conditional `PartialEq`, `Eq`, and `Hash` implementations for `statfs`, `dirent`, and `vnstat` when `extra_traits` feature is enabled. Custom implementations handle array field comparisons properly.

## Constants and Macros (L427-455)
- `RAND_MAX`, `ELAST`: Standard C library limits
- `SPECNAMELEN`: Maximum device name length (63 characters)
- `makedev()`, `major()`, `minor()`: Device number manipulation functions using FreeBSD's specific bit layout

## Foreign Function Interface (L457-480)
External C function declarations for:
- Memory protection (`mprotect`)
- Message queues (`msgrcv`)
- Path manipulation (`dirname`, `basename`)
- Locale management (`freelocale`)
- Sorting with custom comparator (`qsort_r` with FreeBSD 1.0 symbol versioning)

## Architecture-Specific Extensions (L482-487)
Conditional compilation for x86_64-specific definitions via submodule inclusion.

## Dependencies
- Imports `off_t` and prelude types from parent crate modules
- References numerous crate-level type aliases (e.g., `crate::pid_t`, `crate::time_t`)
- Uses conditional compilation macros `s!`, `s_no_extra_traits!`, `safe_f!`, `cfg_if!`