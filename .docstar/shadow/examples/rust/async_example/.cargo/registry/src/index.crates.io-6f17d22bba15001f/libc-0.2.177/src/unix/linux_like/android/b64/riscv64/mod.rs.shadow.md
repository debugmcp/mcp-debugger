# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b64/riscv64/mod.rs
@source-hash: 10705a5608bc7617
@generated: 2026-02-09T17:56:58Z

**libc RISC-V 64-bit Android Platform Bindings**

Platform-specific definitions for Android on RISC-V 64-bit architecture, providing C ABI compatibility layer for system calls, data structures, and hardware capabilities.

**Core Purpose:**
- Defines platform-specific type aliases, structures, and constants for Android RISC-V 64-bit
- Provides system call number mappings for kernel interface
- Exposes hardware capability flags and auxiliary vector constants

**Key Type Definitions (L4-7):**
- `wchar_t = u32`: Wide character type for RISC-V 64-bit Android
- `greg_t = i64`: General register type for signal contexts
- `__u64 = c_ulonglong`, `__s64 = c_longlong`: Kernel unsigned/signed 64-bit types

**Critical Data Structures:**
- `stat` (L10-31): File system stat structure with 64-bit file sizes, nanosecond timestamps
- `stat64` (L33-54): Identical to stat - both use 64-bit fields on this platform
- `max_align_t` (L58-61): 16-byte aligned structure for maximum alignment requirements

**System Call Numbers (L80-372):**
Complete mapping of Linux system call numbers to constants, organized by functionality:
- I/O operations: `SYS_io_setup` (0) through `SYS_io_getevents` (4)
- File operations: `SYS_openat` (56), `SYS_close` (57), `SYS_read` (63), `SYS_write` (64)
- Process control: `SYS_clone` (220), `SYS_execve` (221), `SYS_exit` (93)
- Memory management: `SYS_mmap`, `SYS_munmap` (215), `SYS_mprotect` (226)
- Modern syscalls: `SYS_io_uring_setup` (425), `SYS_pidfd_open` (434), `SYS_landlock_*` (444-446)

**Hardware & Platform Constants:**
- File operation flags (L64-67): `O_DIRECT`, `O_DIRECTORY`, `O_NOFOLLOW`, `O_LARGEFILE`
- Signal stack sizes (L69-70): `SIGSTKSZ` (8192), `MINSIGSTKSZ` (2048)
- RISC-V ISA capability flags (L72-78): Bitfield constants for I, M, A, F, D, C extensions
- Auxiliary vector constants (L375-383): Cache geometry and system information for ELF loading

**Architectural Decisions:**
- Uses `s!{}` macro for structures with standard traits
- Uses `s_no_extra_traits!{}` for `max_align_t` to avoid auto-derived traits
- All system call constants use `c_long` type for ABI compatibility
- Private padding fields (`__pad1`, `__unused4`) maintain ABI layout compatibility

**Dependencies:**
- Imports `off64_t` and common prelude from parent crate modules
- Relies on C primitive type aliases (`c_int`, `c_ulong`, etc.) from libc prelude