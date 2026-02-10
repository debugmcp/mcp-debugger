# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/riscv64/mod.rs
@source-hash: e13c6430f950035f
@generated: 2026-02-09T17:56:59Z

**Purpose**: RISC-V 64-bit architecture-specific definitions for musl libc on Linux systems. Provides platform-specific type definitions, system structures, syscall numbers, and constants.

**Key Type Definitions (L6-11)**:
- `wchar_t = c_int` - Wide character type
- `nlink_t = c_uint` - Number of hard links
- `blksize_t = c_int` - Block size type
- `__u64/__s64` - 64-bit unsigned/signed integer types

**Core Structures**:
- `stat` (L14-34) - File status information with RISC-V-specific layout including device, inode, mode, timestamps with nanosecond precision
- `stat64` (L36-56) - 64-bit version using `off64_t` for file size and `ino64_t` for inode numbers
- `ipc_perm` (L58-70) - System V IPC permission structure with user/group IDs and access mode
- `clone_args` (L72-85) - Arguments for clone3 system call with 8-byte alignment

**Context Structures (L88-125)**:
- `ucontext_t` (L89-95) - User context for signal handling
- `mcontext_t` (L97-101) - Machine context with 32 general registers and floating-point state, 16-byte aligned
- `__riscv_mc_fp_state` (L103-107) - Union for different RISC-V floating-point extensions (F/D/Q)
- Floating-point extension states (L109-124) for single, double, and quad precision

**System Call Numbers (L127-425)**:
- Comprehensive mapping of Linux syscalls to RISC-V-specific numbers
- Ranges from basic I/O (read=63, write=64) to modern syscalls (landlock_restrict_self=446)
- Notable: Uses RISC-V-specific syscall numbering scheme

**File Operation Constants (L427-439)**:
- POSIX file flags with RISC-V-specific values (O_DIRECT=0x4000, O_LARGEFILE=0o100000)

**Signal Definitions (L441-554)**:
- Stack sizes: SIGSTKSZ=8192, MINSIGSTKSZ=2048
- Standard POSIX signals with RISC-V-specific numbers
- Signal handling flags (SA_ONSTACK, SA_SIGINFO)

**Error Codes (L444-526)**:
- Extended POSIX error numbers specific to Linux/RISC-V

**Terminal I/O Constants (L556-661)**:
- Comprehensive termios definitions for serial communication
- Baud rates from standard to high-speed (up to 4Mbps)
- Control flags and special characters

**Register Definitions (L663-672)**:
- RISC-V general-purpose register count (NGREG=32)
- Register aliases (PC, RA, SP, etc.) for debugging and context switching

**Architecture Notes**:
- Uses standard RISC-V calling convention register mapping
- Supports all major RISC-V floating-point extensions
- 16-byte alignment requirements for certain structures reflect RISC-V ABI requirements