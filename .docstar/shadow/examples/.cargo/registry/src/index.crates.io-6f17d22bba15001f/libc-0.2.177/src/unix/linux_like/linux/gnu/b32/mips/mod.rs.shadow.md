# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/mips/mod.rs
@source-hash: 981838f4092d4e3e
@generated: 2026-02-09T17:57:08Z

## Purpose
MIPS 32-bit GNU/Linux system-specific type definitions and constants for the Rust libc crate. This module provides low-level C bindings for MIPS architecture running on Linux with GNU libc, handling both traditional and 64-bit file offset variants.

## Core Components

### Type Definitions
- `wchar_t` (L4): Wide character type defined as `i32` for MIPS
- `max_align_t` (L255-259): 8-byte aligned structure for maximum alignment requirements

### File System Structures
- `stat` (L6-64): Standard file status structure with conditional fields based on `gnu_time_bits64` and `gnu_file_offset_bits64` feature flags
- `stat64` (L66-117): 64-bit file status structure using `off64_t` and `ino64_t`
- `statfs` (L119-133): File system statistics structure
- `statfs64` (L135-148): 64-bit file system statistics with explicit `u64` fields
- `statvfs64` (L150-164): VFS statistics structure for 64-bit systems
- `flock` (L241-251): File locking structure with conditional padding

### IPC Structures
- `ipc_perm` (L189-200): IPC permission structure for shared memory, message queues, and semaphores
- `shmid_ds` (L202-213): Shared memory segment descriptor
- `msqid_ds` (L215-239): Message queue descriptor with endian-specific padding

### Signal Handling
- `sigaction` (L167-174): Signal action structure with function pointer and deprecated PartialEq trait
- `siginfo_t` (L182-187): Signal information structure with large padding array
- `stack_t` (L176-180): Signal stack structure

## System Call Numbers
Comprehensive MIPS system call definitions (L263-652) using base offset `4000`, including:
- Basic syscalls: `SYS_read` (L266), `SYS_write` (L267), `SYS_open` (L268)
- Modern syscalls: `SYS_io_uring_setup` (L627), `SYS_pidfd_send_signal` (L626)
- Deprecated syscalls marked with `#[deprecated]`: `SYS_create_module` (L384-385), `SYS_get_kernel_syms` (L388-389)

## Constants

### File Operations
- File flags: `O_LARGEFILE` (L261), `O_DIRECT` (L654-656), standard POSIX flags (L658-668)
- File locking: `F_GETLK` (L819-822) with conditional values based on `gnu_file_offset_bits64`

### Error Codes
MIPS-specific errno values (L670-752) including networking errors and extended POSIX error codes

### Memory Management
- Memory mapping flags: `MAP_NORESERVE` through `MAP_STACK` (L754-763)
- Memory locking: `MCL_CURRENT`, `MCL_FUTURE`, `MCL_ONFAULT` (L833-835)

### Signal Constants
Signal numbers (L771-793) and signal handling flags (L768-769, L791-793)

### Terminal I/O
Extensive terminal control constants (L795-923) including baud rates, control flags, and special characters

## Architecture Details
- MIPS-specific features: cache control syscalls `SYS_cacheflush` (L406), `SYS_sysmips` (L408)
- Endian-aware structure layout in `msqid_ds` with big/little endian conditional fields
- Feature flag conditional compilation for time64 and large file support
- Stack sizes: `SIGSTKSZ` (L837), `MINSIGSTKSZ` (L838)

## Dependencies
Imports common libc types (`off64_t`, `off_t`) and uses internal macros (`s!`, `s_no_extra_traits!`) for structure definition.