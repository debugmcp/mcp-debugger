# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/x86_64/mod.rs
@source-hash: be62714a2ff04387
@generated: 2026-02-09T17:58:25Z

**libc-0.2.177/src/unix/linux_like/linux/uclibc/x86_64/mod.rs**

**Purpose**: Platform-specific type definitions and C structure layouts for uClibc on x86_64 Linux systems. Provides low-level system interface bindings for 64-bit uClibc environments.

**Key Components**:

**Type Aliases (L6-25)**: Core system types mapped to Rust equivalents:
- Basic types: `blkcnt_t`, `blksize_t`, `clock_t`, `ino_t`, `off_t`, `time_t`, `wchar_t` 
- File system types: `fsblkcnt_t`, `fsfilcnt_t`, `fsword_t`
- Notable: `stat64 = stat` (L16) - identical on x86_64
- 64-bit extensions: `fsblkcnt64_t`, `fsfilcnt64_t`, `__u64`, `__s64`

**Core System Structures (L26-293)**:
- **IPC structures**: `ipc_perm` (L27-39), `shmid_ds` (L66-77), `msqid_ds` (L79-91)
- **Threading**: `pthread_attr_t` (L42-52), `__sched_param` (L54-56) 
- **Signal handling**: `siginfo_t` (L58-64), `sigaction` (L149-154), `sigset_t` (L230-233)
- **Networking**: `sockaddr` variants (L93-111), `msghdr` (L209-218), `cmsghdr` (L288-292)
- **File system**: `stat` (L125-145), `statfs`/`statfs64` (L163-191), `statvfs64` (L193-207)
- **Terminal**: `termios` (L220-228)
- **System info**: `sysinfo` (L235-251), `cpu_set_t` (L266-272)
- **Synchronization**: `sem_t` (L280-286)

**Directory Entry (L295-303)**: `dirent` struct with `s_no_extra_traits!` macro, using 64-bit inode numbers.

**Error Constants (L306-324)**: Network and file system error codes (ENAMETOOLONG, ELOOP, EADDRINUSE, etc.).

**File/Socket Constants (L325-345)**: O_* flags for file operations, socket types, pthread sizing constants.

**Conditional Compilation (L347-355)**: Platform-specific module inclusion using `cfg_if!` - includes either `l4re` or `other` module based on target OS.

**Dependencies**: 
- `crate::off64_t`, `crate::prelude::*` (L3-4)
- Extensive use of `crate::` prefixed types throughout structures

**Architecture Notes**:
- x86_64 specific field ordering in `stat` struct (L128-129 comment)
- Several structures marked with FIXME comments indicating potential verification needs
- Warning comment (L113-115) about unverified definitions that might break software