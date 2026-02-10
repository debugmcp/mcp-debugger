# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/x86_64/mod.rs
@source-hash: be62714a2ff04387
@generated: 2026-02-09T17:57:04Z

This module provides platform-specific type definitions and constants for uClibc on x86_64 (64-bit) Linux systems. It's part of the libc crate's hierarchical platform abstraction layer.

**Primary Purpose**: Defines C-compatible types, structures, and constants that match uClibc's ABI on x86_64 architecture, enabling safe FFI with system calls and C libraries.

**Key Type Definitions (L6-25)**:
- Basic system types: `blkcnt_t`, `blksize_t`, `clock_t`, `ino_t`, `off_t`, `time_t`, `wchar_t`
- File system types: `fsblkcnt_t`, `fsfilcnt_t`, `fsword_t`
- 64-bit variants: `fsblkcnt64_t`, `fsfilcnt64_t`, `__u64`, `__s64`
- Notable: `stat64` aliased to `stat` (L16) due to identical layout on x86_64

**Critical Structures**:
- `ipc_perm` (L27-39): IPC permissions with padding for alignment
- `pthread_attr_t` (L42-52): Thread attributes, conditionally compiled for non-L4RE
- `siginfo_t` (L58-64): Signal information with unported union as padding array
- `stat` (L125-145): File metadata with swapped nlink/mode order specific to x86_64
- `sigaction` (L149-154): Signal handler configuration with function pointer
- Network structures: `sockaddr` (L93-96), `sockaddr_in` (L98-103), `sockaddr_in6` (L105-111)
- File system info: `statfs` (L163-176), `statfs64` (L178-191), `statvfs64` (L193-207)

**Architecture-Specific Elements**:
- `cpu_set_t` (L266-272): CPU affinity masks sized for 64-bit pointers
- `sem_t` (L280-286): Semaphore with size dependent on pointer width
- `dirent` (L296-302): Directory entries using 64-bit inode numbers

**Dependencies**:
- Imports from crate root: `off64_t`, `prelude::*`
- Uses conditional compilation via `cfg_if!` macro (L347-355)
- Conditionally includes `l4re` or `other` submodules

**Constants Section (L306-345)**:
- Error codes: POSIX errno values (ENAMETOOLONG, ELOOP, network errors)
- File operation flags: O_APPEND, O_CREAT, O_DIRECTORY, etc.
- Socket types: SOCK_DGRAM, SOCK_STREAM
- pthread sizing constants for mutex, condition variables, barriers

**Architectural Notes**:
- Comment at L128-129 documents uclibc-specific field ordering in `stat`
- Multiple structures marked with "FIXME(ulibc)" indicating incomplete verification
- Unverified definitions section (L113-124) with commented-out code
- Uses `s!` and `s_no_extra_traits!` macros for structure generation