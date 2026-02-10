# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/wasm32/mod.rs
@source-hash: 2d2a01fd01b372eb
@generated: 2026-02-09T17:57:07Z

## Purpose
Platform-specific definitions for Wasm32 architecture conforming to the WALI (WebAssembly Linux Interface) ABI. This module provides system call numbers, data structures, constants, and type definitions that mirror x86_64 Linux, enabling POSIX-like functionality in WebAssembly environments.

## Key Components

### Type Definitions (L6-10)
- `wchar_t = i32`: Wide character type for Unicode support
- `nlink_t = u64`: File link count type  
- `blksize_t = c_long`: Block size type for filesystem operations
- `__u64/__s64`: Unsigned/signed 64-bit integer types

### Core Data Structures

#### `stat` struct (L13-32)
Standard file metadata structure containing:
- Device/inode information (`st_dev`, `st_ino`)
- File permissions and ownership (`st_mode`, `st_uid`, `st_gid`) 
- Size and block information (`st_size`, `st_blocks`, `st_blksize`)
- Timestamps with nanosecond precision (`st_atime`, `st_mtime`, `st_ctime`)

#### `stat64` struct (L34-53)
Extended version with 64-bit inode support (`st_ino: ino64_t`) and block counts (`st_blocks: blkcnt64_t`)

#### `ipc_perm` struct (L55-73)
Inter-process communication permissions with conditional field naming:
- `__key` (musl v1.2.3+) or deprecated `__ipc_perm_key` (L56-64)
- User/group IDs for owner and creator
- Access mode and sequence number

### System Call Table (L77-438)
Comprehensive mapping of Linux system calls to numeric constants:
- Basic I/O: `SYS_read` (0), `SYS_write` (1), `SYS_open` (2)
- Process management: `SYS_fork` (57), `SYS_execve` (59), `SYS_exit` (60)
- Memory management: `SYS_mmap` (9), `SYS_munmap` (11), `SYS_brk` (12)
- Modern syscalls: `SYS_io_uring_*` (425-427), `SYS_landlock_*` (444-446)

### File Operation Constants (L443-456)
Standard file descriptor flags:
- `O_CREAT`, `O_EXCL`, `O_APPEND` for file creation/writing modes
- `O_DIRECT`, `O_SYNC`, `O_ASYNC` for I/O behavior control
- `O_DIRECTORY`, `O_NOFOLLOW` for path resolution

### Error Codes (L464-546)
Extended POSIX error constants including:
- File system errors: `ENAMETOOLONG` (36), `ENOTEMPTY` (39)
- Network errors: `ECONNREFUSED` (111), `ETIMEDOUT` (110)  
- Security errors: `ENOKEY` (126), `EKEYEXPIRED` (127)

### Signal Handling (L548-574)
Signal action flags and signal numbers:
- `SA_SIGINFO` (0x4), `SA_ONSTACK` (0x08000000)
- Standard signals: `SIGCHLD` (17), `SIGUSR1` (10), `SIGIO` (29)

### Terminal I/O (L576-682)
Comprehensive terminal control constants:
- Baud rates from `B57600` to `B4000000` 
- Control flags: `CREAD`, `PARENB`, `CSTOPB`
- Input/output processing: `IXON`, `ONLCR`, `ECHOE`

## Architecture Notes
- Located in `b64` module despite Wasm32 being 32-bit, reflecting WALI ABI's x86_64 compatibility
- Conditional compilation for musl library version differences (L683-688)
- Uses `s!` macro for structure definitions (common libc pattern)

## Dependencies
- `crate::off_t` and `crate::prelude::*` imports
- Extensive use of crate-local type aliases (`crate::dev_t`, etc.)
- Platform-specific wali submodule integration