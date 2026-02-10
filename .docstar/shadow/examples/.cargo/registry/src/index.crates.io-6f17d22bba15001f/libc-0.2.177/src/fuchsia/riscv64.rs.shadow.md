# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/fuchsia/riscv64.rs
@source-hash: f2aba92cb88480bd
@generated: 2026-02-09T18:06:17Z

## Purpose
Platform-specific type definitions and data structures for Fuchsia OS on RISC-V 64-bit architecture. Part of the libc crate's platform abstraction layer.

## Key Type Definitions
- `__u64` (L5): 64-bit unsigned integer following RISC-V psABI calling convention
- `wchar_t` (L6): Wide character type as 32-bit signed integer
- `nlink_t` (L8): Hard link count type using `c_ulong`
- `blksize_t` (L9): Block size type using `c_long`
- `stat64` (L11): Type alias for `stat` structure (no separate 64-bit variant)

## Data Structures
- `stat` struct (L13-32): File status information containing:
  - Device and inode identifiers (`st_dev`, `st_ino`)
  - File metadata (`st_mode`, `st_uid`, `st_gid`, `st_nlink`)
  - Size and block information (`st_size`, `st_blksize`, `st_blocks`)
  - Timestamps with nanosecond precision (`st_atime`/`st_mtime`/`st_ctime` + `_nsec` fields)
  - Padding and unused fields for binary compatibility

- `ipc_perm` struct (L35-45): IPC permission structure (non-functional on Fuchsia)
  - Contains standard Unix IPC permission fields
  - Marked as unused since IPC calls return ENOSYS on Fuchsia

## Dependencies
- Imports `off_t` type and prelude from parent crate
- Uses various primitive types from crate root (`dev_t`, `ino_t`, `mode_t`, etc.)

## Architecture Notes
- RISC-V 64-bit specific implementations following psABI conventions
- Fuchsia OS adaptations where IPC functionality is disabled
- Binary layout compatibility maintained through explicit padding fields