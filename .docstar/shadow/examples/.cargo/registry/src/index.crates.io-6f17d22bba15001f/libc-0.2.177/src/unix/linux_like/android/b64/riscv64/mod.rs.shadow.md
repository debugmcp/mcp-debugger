# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/b64/riscv64/mod.rs
@source-hash: 10705a5608bc7617
@generated: 2026-02-09T17:58:14Z

## Purpose
Platform-specific definitions for Android on RISC-V 64-bit architecture. Part of the libc crate's hierarchical structure providing low-level C bindings. Defines types, structures, constants, and system call numbers specific to the Android RISC-V 64-bit target.

## Key Type Definitions (L4-7)
- `wchar_t = u32`: Wide character type for Unicode handling
- `greg_t = i64`: General register type for signal contexts  
- `__u64 = c_ulonglong`: Unsigned 64-bit integer alias
- `__s64 = c_longlong`: Signed 64-bit integer alias

## Core Structures

### stat and stat64 (L10-54)
Both structures have identical layouts representing file metadata:
- Device IDs (`st_dev`, `st_rdev`) 
- Inode number (`st_ino`)
- File permissions and type (`st_mode`)
- Link count (`st_nlink`) 
- Owner/group IDs (`st_uid`, `st_gid`)
- File size (`st_size` as `off64_t`)
- Block information (`st_blksize`, `st_blocks`)
- Timestamps with nanosecond precision (`st_atime`/`st_atime_nsec`, etc.)
- Private padding fields for ABI compatibility

### max_align_t (L58-61) 
16-byte aligned structure using `f32` array for maximum alignment requirements on RISC-V 64-bit.

## File Operation Constants (L64-67)
- `O_DIRECT`: Direct I/O bypassing cache
- `O_DIRECTORY`: Ensure path is directory  
- `O_NOFOLLOW`: Don't follow symbolic links
- `O_LARGEFILE`: Enable large file support

## Signal Stack Constants (L69-70)
- `SIGSTKSZ = 8192`: Default signal stack size
- `MINSIGSTKSZ = 2048`: Minimum signal stack size

## RISC-V Hardware Capabilities (L73-78)
COMPAT_HWCAP constants for ISA extensions using bit positions based on letter encoding:
- ISA_I, ISA_M, ISA_A, ISA_F, ISA_D, ISA_C for various RISC-V instruction set extensions

## System Call Numbers (L80-372)
Comprehensive mapping of Linux system calls to numeric identifiers for RISC-V architecture. Organized by functional areas:
- I/O operations (0-4)
- Extended attributes (5-16) 
- File system operations (17-61)
- Process management (93-179)
- IPC mechanisms (180-197)
- Networking (198-212)
- Memory management (214-239)
- Modern syscalls (424-450)

Notable gaps in numbering reflect architecture-specific syscall table organization.

## Auxiliary Vector Constants (L375-383)
ELF auxiliary vector entries for runtime information:
- `AT_SYSINFO_EHDR`: VDSO location
- Cache geometry constants (`AT_L1I_CACHESIZE` through `AT_L3_CACHEGEOMETRY`)
- `AT_VECTOR_SIZE_ARCH`: Architecture-specific vector size

## Dependencies
- Imports `off64_t` and common prelude types from parent modules
- Uses `s!` and `s_no_extra_traits!` macros for structure definitions (libc crate conventions)
- All primitive types (`c_int`, `c_long`, etc.) from prelude