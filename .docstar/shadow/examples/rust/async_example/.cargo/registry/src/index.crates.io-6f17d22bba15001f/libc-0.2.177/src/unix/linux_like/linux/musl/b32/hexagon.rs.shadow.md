# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/hexagon.rs
@source-hash: 1b0c68839dc46d00
@generated: 2026-02-09T17:57:10Z

## Purpose
Platform-specific definitions for Hexagon architecture (32-bit) on musl libc within Linux environments. Part of the libc crate's architecture-specific binding layer, providing low-level system constants, data structures, and type definitions required for system programming on Hexagon processors.

## Key Components

### Type Definitions (L3-4)
- `wchar_t = u32` (L3): Wide character type for Hexagon
- `stat64 = crate::stat` (L4): 64-bit stat structure alias

### Core Data Structures (L6-86)
- `stat` (L7-28): File metadata structure with device info, inode, permissions, timestamps, and padding fields for alignment
- `stack_t` (L30-34): Signal stack descriptor with pointer, flags, and size
- `ipc_perm` (L36-52): IPC permissions structure with conditional compilation for musl version compatibility
  - Contains deprecated field `__ipc_perm_key` (L40-45) with version-specific naming
- `shmid_ds` (L54-68): Shared memory segment descriptor
- `msqid_ds` (L70-85): Message queue descriptor

### Address Family Constants (L88-91)
AF_* constants for socket address families including FILE, KCM, QIPCRTR, and MAX values.

### Error Code Constants (L92-172)
Comprehensive set of POSIX and Linux-specific error codes (E*) mapped to integer values, including network, filesystem, and system-specific errors.

### Extended Terminal Constants (L173)
EXTPROC flag for terminal processing extensions.

### File Control Constants (L174-190)
F_* constants for fcntl operations including locking, ownership, and Linux-specific extensions.

### Terminal I/O Constants (L181, 191)
FLUSHO and IEXTEN flags for terminal control.

### Memory Mapping Constants (L192-202)
MAP_* flags for mmap operations including anonymous mapping, execution permissions, and memory locking options.

### File Operation Constants (L203-214)
O_* flags for open/openat system calls covering creation, synchronization, and access modes.

### Protocol Family Constants (L215-218)
PF_* constants mirroring AF_* values for protocol families.

### Signal Handling Constants (L219-246)
SA_* flags for signal action configuration and SIG_* constants for signal masking operations.

### Signal Numbers (L222-243)
Platform-specific signal number definitions including SIGBUS, SIGCHLD, SIGIO, and stack size constants.

### Socket Constants (L247-256)
SOCK_* types and SOL_* socket level constants for various protocol layers.

### System Call Numbers (L258-612)
Extensive mapping of system call names to numbers, including:
- Standard POSIX calls (open, read, write, etc.)
- Linux-specific calls (epoll, inotify, etc.)  
- Architecture-specific variants (SYS3264_* for 32/64-bit compatibility)
- Modern system calls (io_uring, pidfd_*, etc.)

### Terminal Control Constants (L613-621)
TIOC* and V* constants for terminal I/O control operations.

## Architecture Notes
- Hexagon-specific 32-bit architecture targeting
- Uses musl libc implementation
- Includes compatibility layers for 32/64-bit system calls via SYS3264_* constants
- Contains version-conditional compilation for musl library compatibility

## Dependencies
- Imports from `crate::prelude::*` for common type definitions
- References various crate-level types (dev_t, time_t, uid_t, etc.)
- Uses `s!` macro for structure definitions (likely from parent crate)