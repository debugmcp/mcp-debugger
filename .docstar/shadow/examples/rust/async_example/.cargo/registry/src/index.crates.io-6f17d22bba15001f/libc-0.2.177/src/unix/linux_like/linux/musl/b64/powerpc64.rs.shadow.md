# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/powerpc64.rs
@source-hash: 03552edded40fccc
@generated: 2026-02-09T17:57:08Z

## Purpose

Platform-specific type definitions and constants for PowerPC64 architecture on Linux musl libc. This file provides the architecture-specific implementation layer for system interfaces, defining struct layouts, error codes, system call numbers, and terminal control constants.

## Key Components

### Type Definitions (L4-8)
- `wchar_t`: Wide character type as `i32`
- `__u64`/`__s64`: Platform-specific 64-bit unsigned/signed integers
- `nlink_t`: File link count type as `u64`
- `blksize_t`: Block size type as `c_long`

### Core System Structures

**termios (L11-20)**: Terminal I/O control structure containing:
- Control flags: `c_iflag`, `c_oflag`, `c_cflag`, `c_lflag`
- Control character array `c_cc` and line discipline `c_line`
- Private speed fields `__c_ispeed`, `__c_ospeed`

**stat (L22-41)**: File status structure with standard Unix fields including device, inode, mode, ownership, size, and timestamps. Contains padding field `__pad0` (L29) and unused array (L40).

**stat64 (L43-62)**: 64-bit version of stat structure with `ino64_t` and `blkcnt64_t` types, includes reserved space (L61).

**shmid_ds (L64-74)**: Shared memory segment descriptor with permissions, timestamps, size, and process IDs.

**ipc_perm (L76-94)**: IPC permissions structure with conditional compilation for musl version compatibility:
- Uses `__key` field for musl v1.2.3+ (L78)
- Deprecated `__ipc_perm_key` for older versions (L79-85)

### Constants Categories

**Memory Management** (L97-212):
- `MADV_*`: Memory advice constants
- `MAP_*`: Memory mapping flags including deprecated `MAP_32BIT` (L98-103)
- `O_*`: File opening flags (L104-116)

**Error Codes** (L118-200): Complete set of Linux errno values from `ENAMETOOLONG` to `EHWPOISON`

**System Call Numbers** (L262-668): Comprehensive PowerPC64-specific syscall table from `SYS_restart_syscall` (0) to `SYS_set_mempolicy_home_node` (450). Includes deprecated syscalls with deprecation warnings (L390-395, L431-432).

**Terminal Control** (L673-752):
- Special character indices (`VEOL`, `VMIN`, etc.)
- Terminal flags (`IEXTEN`, `TOSTOP`, `FLUSHO`)
- Baud rate constants (`B57600` through `B4000000`)
- Control character processing flags

## Architecture Dependencies

- PowerPC64-specific syscall numbering
- 64-bit type alignments and sizes
- Platform-specific constant values for signals, memory mapping, and terminal control
- musl libc version-specific conditional compilation

## Notable Patterns

- Uses `s!` macro for structure definitions (L10)
- Extensive use of `crate::` prefixed types for consistency
- Deprecation attributes with version tracking and explanatory notes
- Octal notation for traditional Unix constants (terminal control)
- Comprehensive error code coverage matching Linux kernel definitions