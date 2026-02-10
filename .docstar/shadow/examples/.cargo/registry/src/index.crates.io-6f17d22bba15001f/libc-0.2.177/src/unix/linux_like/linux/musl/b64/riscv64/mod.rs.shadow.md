# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/riscv64/mod.rs
@source-hash: e13c6430f950035f
@generated: 2026-02-09T17:57:13Z

## Purpose
RISC-V 64-bit architecture-specific definitions for musl libc on Linux. Provides platform-specific type aliases, data structures, system call numbers, and constants required for RISC-V64 binaries running on Linux with musl C library.

## Key Components

### Type Definitions (L6-11)
- `wchar_t = c_int` - Wide character type
- `nlink_t = c_uint` - File link count type
- `blksize_t = c_int` - Block size type
- `__u64/__s64` - Explicit 64-bit integer types

### Core Data Structures

#### File System Structures (L13-56)
- `stat` (L14-34) - Standard file metadata structure with RISC-V specific layout
- `stat64` (L36-56) - 64-bit file metadata structure, differs from `stat` in `st_ino` (uses `ino64_t`) and `st_size` (uses `off64_t`)

#### IPC Structure (L58-70)
- `ipc_perm` (L58-70) - Inter-process communication permissions structure with RISC-V specific padding

#### Process Management (L72-85)
- `clone_args` (L73-85) - Arguments for clone3() system call, 8-byte aligned

### Context Switching Structures (L88-125)
- `ucontext_t` (L89-95) - User context for signal handling
- `mcontext_t` (L98-101) - Machine context with 32 general-purpose registers and floating-point state
- `__riscv_mc_fp_state` (L103-107) - Union for different floating-point extensions
- Floating-point state structures for F/D/Q extensions (L109-124)

### System Call Numbers (L127-425)
Complete RISC-V64 system call number definitions including:
- Basic I/O: `SYS_read` (63), `SYS_write` (64), `SYS_close` (57)
- Memory management: `SYS_mmap` (222), `SYS_brk` (214)
- Process control: `SYS_clone` (220), `SYS_execve` (221), `SYS_exit` (93)
- Modern syscalls: `SYS_clone3` (435), `SYS_io_uring_*` (425-427)

### File Operation Constants (L427-439)
RISC-V specific file operation flags like `O_APPEND` (1024), `O_DIRECT` (0x4000), etc.

### Signal Handling Constants (L441-555)
- Stack sizes: `SIGSTKSZ` (8192), `MINSIGSTKSZ` (2048)
- Signal numbers: `SIGCHLD` (17), `SIGBUS` (7), etc.
- Signal action flags and masks

### Error Codes (L444-526)
Extended error number definitions specific to RISC-V/musl environment.

### Terminal I/O Constants (L562-661)
Comprehensive terminal control flags, baud rates, and character indices for RISC-V systems.

### Register Definitions (L663-672)
RISC-V register indices for debugging/context switching: `REG_PC`, `REG_RA`, `REG_SP`, etc.

## Architecture Notes
- Uses RISC-V specific system call numbers (different from x86/ARM)
- Floating-point state handling supports F, D, and Q extensions
- 16-byte alignment required for quad-precision floating-point context
- Maintains compatibility with musl libc ABI requirements