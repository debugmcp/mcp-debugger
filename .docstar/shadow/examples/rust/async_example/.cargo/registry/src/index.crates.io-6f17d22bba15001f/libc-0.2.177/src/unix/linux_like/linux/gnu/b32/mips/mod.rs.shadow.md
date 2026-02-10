# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/mips/mod.rs
@source-hash: 981838f4092d4e3e
@generated: 2026-02-09T17:57:01Z

## MIPS 32-bit GNU/Linux System Definitions

This module provides MIPS-specific system definitions for 32-bit GNU/Linux environments, part of the Rust `libc` crate. It defines platform-specific structures, constants, and types that map to the underlying C library interfaces.

### Key Components

**Type Definitions:**
- `wchar_t` (L4): Platform-specific wide character type, defined as `i32` for MIPS

**Core System Structures:**

**File System Structures:**
- `stat` (L7-64): File metadata structure with conditional fields based on feature flags (`gnu_time_bits64`, `gnu_file_offset_bits64`) for time and file offset compatibility
- `stat64` (L66-117): 64-bit version of stat structure with similar conditional compilation
- `statfs` (L119-133): File system statistics structure  
- `statfs64` (L135-148): 64-bit file system statistics with explicit `u64` fields
- `statvfs64` (L150-164): POSIX-compliant file system information structure

**Process Control Structures:**
- `sigaction` (L168-174): Signal handling configuration with function pointer and mask fields
- `stack_t` (L176-180): Signal stack specification
- `siginfo_t` (L182-187): Signal information with large padding array for extensibility

**IPC (Inter-Process Communication) Structures:**
- `ipc_perm` (L189-200): IPC permission structure
- `shmid_ds` (L202-213): Shared memory segment descriptor
- `msqid_ds` (L215-239): Message queue descriptor with endian-specific padding
- `flock` (L241-251): File locking structure with conditional fields

**Memory Alignment:**
- `max_align_t` (L256-258): Platform-specific maximum alignment type using 8-byte alignment

### System Call Numbers
Extensive system call number definitions (L263-652) mapping Linux system calls to MIPS-specific numbers (base offset 4000). Includes both legacy and modern system calls, with some deprecated entries marked with deprecation attributes.

### File Operation Constants
- File flags (L654-668): `O_LARGEFILE`, `O_DIRECT`, `O_DIRECTORY`, etc.
- Standard file operations (L658-668): `O_APPEND`, `O_CREAT`, `O_NONBLOCK`, etc.

### Error Codes
Platform-specific error number definitions (L670-752) mapping to MIPS errno values.

### Memory Management Constants
- Memory mapping flags (L754-763): `MAP_NORESERVE`, `MAP_ANON`, `MAP_GROWSDOWN`, etc.

### Socket and Signal Constants
- Socket types (L765-766): `SOCK_STREAM`, `SOCK_DGRAM`
- Signal handling flags (L768-793) and signal numbers (L771-790)
- Terminal control constants (L795-924)

### Architecture-Specific Details
The code extensively uses conditional compilation (`#[cfg(...)]`) to handle:
- Time representation differences (`gnu_time_bits64`)
- File offset size variations (`gnu_file_offset_bits64`) 
- Endianness-specific field ordering (`target_endian`)

This ensures binary compatibility across different MIPS GNU/Linux configurations while maintaining a unified Rust interface.