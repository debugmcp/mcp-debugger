# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/wasm32/mod.rs
@source-hash: 2d2a01fd01b372eb
@generated: 2026-02-09T17:57:17Z

**Purpose:** WebAssembly32 (WASM32) system definitions for the libc crate targeting musl Linux with WALI ABI compatibility. Provides WASM32-specific type definitions, system call constants, file metadata structures, and terminal control flags that mirror x86_64 Linux behavior.

**Architecture:** Part of the libc crate's hierarchical platform-specific module structure (`unix/linux_like/linux/musl/b64/wasm32`). Despite being WASM32, it resides in the `b64` module because the WALI ABI closely mirrors 64-bit x86_64 Linux conventions.

**Key Components:**

**Type Definitions (L6-10):**
- `wchar_t = i32`: Wide character type
- `nlink_t = u64`: File link count type  
- `blksize_t = c_long`: Block size type
- `__u64/__s64`: 64-bit unsigned/signed integer types

**Core Structures (L12-74):**
- `stat` (L13-32): Standard file metadata structure with device, inode, mode, ownership, size, timestamps, and padding fields
- `stat64` (L34-53): 64-bit variant using `ino64_t` and `blkcnt64_t` for large file support
- `ipc_perm` (L55-73): IPC permissions structure with conditional field naming based on musl version (`__key` vs deprecated `__ipc_perm_key`)

**System Call Table (L76-438):**
Comprehensive mapping of Linux system calls to numeric constants (0-450), including:
- Basic I/O: `SYS_read/write/open/close` (L77-80)
- File operations: `SYS_stat/fstat/lstat` (L81-83)
- Memory management: `SYS_mmap/munmap/brk` (L86-89)
- Process control: `SYS_fork/execve/exit` (L134-137)
- Modern syscalls: `SYS_io_uring_*` (L413-415), `SYS_landlock_*` (L432-434)

**System Call Aliases (L440-442):**
- `SYS_fadvise = SYS_fadvise64`: WALI-specific alias

**Constants (L443-682):**
- File operation flags: `O_*` constants (L444-456)
- Memory advice: `MADV_SOFT_OFFLINE` (L443)  
- Process tracing: `PTRACE_*` constants (L458-459)
- Signal handling: Stack sizes, signal numbers, SA flags (L461-575)
- File locking: `F_*` constants (L576-580)
- Terminal I/O: Comprehensive `tcflag_t` constants for baud rates, control modes, input/output flags (L582-682)
- Error codes: Extended errno values (L464-546)

**Dependencies:**
- Imports `off_t` and prelude types from parent crate modules (L3-4)
- Uses crate-internal types like `dev_t`, `mode_t`, `uid_t`, etc.

**Conditional Compilation (L683-688):**
- Includes additional WALI-specific definitions when `target_vendor = "wali"` feature is enabled

**Key Patterns:**
- Extensive use of `c_long` for system call numbers following Linux x86_64 conventions
- Octal notation for terminal control constants (traditional Unix style)
- Conditional field naming in `ipc_perm` for backward compatibility
- Comprehensive coverage of both legacy and modern Linux system calls