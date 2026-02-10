# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/loongarch64/mod.rs
@source-hash: f2d8b176c64d791a
@generated: 2026-02-09T17:57:16Z

## LoongArch64 Linux GNU ABI Definitions

This file provides architecture-specific type definitions and constants for the LoongArch64 processor running Linux with GNU C library. It's part of the libc crate's Unix platform support hierarchy.

### Purpose
Defines platform-specific data structures, system call numbers, constants, and type aliases that match the LoongArch64 Linux kernel ABI and GNU libc implementation.

### Key Type Definitions

**Basic Types (L4-10)**
- `wchar_t = i32` - Wide character type
- `blksize_t = i32` - Block size type  
- `nlink_t = u32` - Hard link count type
- `suseconds_t = i64` - Microseconds type
- `__u64/__s64` - 64-bit unsigned/signed types

**File System Structures (L12-131)**
- `stat` (L13-33) - Standard file status structure with timestamps and metadata
- `stat64` (L35-55) - 64-bit version using `off64_t` for large file support
- `statfs/statfs64` (L57-85) - File system statistics with block/inode counts
- `statvfs/statvfs64` (L103-131) - POSIX file system information

**Locking Structures (L87-101)**
- `flock/flock64` - File locking structures for advisory locks

**Threading (L133-135)**
- `pthread_attr_t` - Thread attribute structure (opaque 7×ulong array)

**Signal Handling (L137-165)**
- `sigaction` (L139-144) - Signal action structure with handler and mask
- `stack_t` (L146-150) - Signal stack information
- `siginfo_t` (L152-165) - Signal information with deprecated padding field

**Process Context (L193-236)**
- `user_regs_struct` (L193-199) - LoongArch64 CPU register state (32 GPRs + control)
- `user_fp_struct` (L201-205) - Floating point register state (32 FPRs + control)
- `ucontext_t/mcontext_t` (L207-221) - User context for signal handling
- `clone_args` (L224-236) - Arguments for clone3 system call

**IPC Structures (L167-191)**
- `ipc_perm` (L167-178) - IPC permission structure
- `shmid_ds` (L180-191) - Shared memory segment descriptor

### Threading Constants (L246-294)
Pthread object sizes and mutex initializer constants with endian-specific layouts for recursive, error-checking, and adaptive mutex types.

### Hardware Capabilities (L296-309)
LoongArch64-specific HWCAP constants for CPU feature detection (CPUCFG, LAM, UAL, FPU, LSX, LASX, etc.).

### System Call Numbers (L311-611)
Complete mapping of system call names to numbers for LoongArch64, from basic I/O (read=63, write=64) to modern calls (landlock, futex_waitv).

### File Operation Constants (L613-646)
POSIX advice flags, file open flags (O_DIRECT, O_DIRECTORY, etc.), and file locking constants.

### Error Codes (L647-744)
Extended error code definitions beyond standard POSIX, including network, library, and hardware-specific errors.

### Memory Management (L746-762)
Memory mapping flags (MAP_ANONYMOUS, MAP_HUGETLB, etc.) and memory locking constants.

### Signal Constants (L764-799)
Signal numbers and handling flags specific to LoongArch64 Linux.

### Terminal I/O (L818-916)
Comprehensive terminal control constants including baud rates, control flags, and line discipline settings.

### Architecture Notes
- Uses 16-byte aligned `mcontext_t` for proper context switching
- Supports both 32-bit and 64-bit file operations
- Endian-aware pthread mutex initializers
- LoongArch64-specific register layout in user_regs_struct