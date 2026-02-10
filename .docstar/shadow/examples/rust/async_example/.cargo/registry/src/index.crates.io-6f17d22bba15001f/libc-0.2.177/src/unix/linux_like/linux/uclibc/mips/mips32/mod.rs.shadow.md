# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/mips/mips32/mod.rs
@source-hash: 59493f1ab84ddbcf
@generated: 2026-02-09T17:57:07Z

**MIPS32 uClibc Linux Platform Definitions**

This module provides platform-specific type definitions, structures, constants, and system call numbers for the MIPS32 architecture running Linux with uClibc. It serves as a low-level interface layer for Rust FFI bindings to POSIX and Linux system APIs.

**Type Definitions (L4-18)**
- Basic C type aliases for time, file system, and process-related types
- 32-bit types: `time_t`, `off_t`, `clock_t`, `suseconds_t`, `wchar_t`, `blkcnt_t`, `blksize_t` (all i32)
- Unsigned types: `ino_t`, `nlink_t` (u32), `fsblkcnt_t`, `fsfilcnt_t` (c_ulong)
- 64-bit extensions: `__u64`, `__s64`, `fsblkcnt64_t`, `fsfilcnt64_t`

**Core Structures (L20-267)**
Key POSIX/Linux structures with MIPS32-specific memory layouts:

- **`stat` (L21-42)**: File metadata structure with padding fields for alignment
- **`stat64` (L44-65)**: 64-bit version using `off64_t` and `ino64_t` types
- **`statvfs64` (L67-81)**: File system statistics with 64-bit counters
- **`pthread_attr_t` (L83-85)**: POSIX thread attributes (36 bytes)
- **`sigaction` (L87-92)**: Signal handler configuration
- **`sigset_t` (L100-102)**: Signal mask (128-bit via 4×c_ulong array)
- **`siginfo_t` (L104-109)**: Signal information with large padding
- **IPC structures**: `ipc_perm` (L124-135), `shmid_ds` (L137-148), `msqid_ds` (L150-174)
- **File system**: `statfs`/`statfs64` (L176-204)
- **Networking**: `msghdr` (L206-214), `cmsghdr` (L216-220)
- **Terminal**: `termios` (L222-229)
- **Locking**: `flock` (L231-239)
- **System info**: `sysinfo` (L241-256)
- **Semaphores**: `sem_t` (L258-266) with conditional sizing based on pointer width

**Threading Constants (L269-276)**
Size constants for pthread objects (mutexes, conditions, barriers, etc.) specific to MIPS32 architecture.

**System Call Numbers (L278-666)**
Complete mapping of Linux system calls with MIPS32-specific numbering (base offset 4000):
- Basic syscalls: exit, fork, read, write, open, close (L279-284)
- File operations: stat, lstat, fstat variants including 64-bit versions
- Memory management: mmap, munmap, mprotect, mlock family
- Process control: clone, execve, waitpid, kill
- Signal handling: sigaction, sigprocmask, rt_sig* family
- Modern syscalls: io_uring, landlock, memfd_secret, futex_waitv

**External Functions (L668-695)**
FFI declarations for functions from libutil:
- **`sysctl` (L670-677)**: System parameter control
- **`glob64`/`globfree64` (L678-684)**: 64-bit file globbing
- **pthread affinity functions (L685-694)**: CPU set management for thread attributes

**Architecture Notes**
- MIPS32 uses big-endian conditional compilation for `msqid_ds` structure layout
- System call numbers follow MIPS o32 ABI convention (4000 + syscall_number)
- Structure padding reflects MIPS32 alignment requirements
- 64-bit file operations are explicitly supported alongside 32-bit variants