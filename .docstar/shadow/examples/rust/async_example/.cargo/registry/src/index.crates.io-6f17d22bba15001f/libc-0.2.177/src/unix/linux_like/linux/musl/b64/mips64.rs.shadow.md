# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/mips64.rs
@source-hash: d448cf011098728d
@generated: 2026-02-09T17:57:08Z

**MIPS64 Architecture Definitions for Musl libc on Linux**

Platform-specific type and constant definitions for MIPS64 systems running Linux with musl libc. Part of the libc crate's system bindings hierarchy.

## Core Types (L1-8)
- `wchar_t = i32` (L4) - Wide character type
- `__u64 = c_ulong`, `__s64 = c_long` (L5-6) - 64-bit integer types
- `nlink_t = c_uint` (L7) - File link count type  
- `blksize_t = i64` (L8) - Block size type

## System Structures

### File System Metadata
- `stat` struct (L11-33) - File status information with MIPS64-specific padding
  - Device, inode, mode, ownership fields
  - Time fields with nanosecond precision (`st_atime_nsec`, etc.)
  - Block size and count fields
- `stat64` struct (L35-57) - 64-bit version (identical layout to `stat`)
- `statfs`/`statfs64` structs (L86-114) - File system statistics

### System V IPC
- `ipc_perm` struct (L65-84) - IPC permissions with version-dependent field naming
  - Contains deprecated `__ipc_perm_key` field (L68-74) for older musl versions
  - Conditional compilation based on `musl_v1_2_3` feature

### Signal Handling
- `stack_t` struct (L59-63) - Signal stack configuration

## System Call Numbers (L120-474)
Complete MIPS64 system call table with base offset 5000:
- Basic I/O: `SYS_read = 5000`, `SYS_write = 5001`, etc.
- File operations: `SYS_open`, `SYS_stat`, `SYS_close`
- Memory management: `SYS_mmap`, `SYS_munmap`, `SYS_brk`
- Process control: `SYS_fork`, `SYS_execve`, `SYS_exit`
- Network operations: socket family (L160-174)
- Modern syscalls: `SYS_io_uring_*` (L449-451), `SYS_landlock_*` (L468-470)

## File/Signal Constants
- File operation flags: `O_DIRECT`, `O_DIRECTORY`, `O_NOFOLLOW` (L476-478)
- Standard file flags: `O_CREAT`, `O_EXCL`, `O_NONBLOCK` (L480-489)  
- Error codes: MIPS64-specific errno values (L491-574)
- Memory mapping flags: `MAP_ANON`, `MAP_GROWSDOWN` (L576-585)
- Socket types: `SOCK_STREAM = 2`, `SOCK_DGRAM = 1` (L587-588)
- Signal constants: `SIGEMT = 7`, `SIGCHLD = 18` (L594-616)

## Terminal I/O (L618-706)
Comprehensive terminal control constants:
- Control characters: `VEOF`, `VEOL`, `VMIN` indices
- Input/output flags: `IEXTEN`, `TOSTOP`, `ONLCR`
- Control modes: `CSIZE`, `CS6-CS8`, `CREAD`
- Baud rates: Standard and extended rates up to `B4000000`

## Architecture Notes
- Uses MIPS64 system call numbering (base 5000)
- 64-bit file operations use same structures as 32-bit variants
- Signal stack size: `SIGSTKSZ = 8192`, `MINSIGSTKSZ = 2048`
- Includes MIPS64-specific memory mapping and file flags