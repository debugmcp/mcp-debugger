# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/x86/mod.rs
@source-hash: 264aafdd2d3dbbf5
@generated: 2026-02-09T17:57:15Z

## Purpose
Platform-specific definitions for 32-bit x86 musl libc on Linux. Provides low-level system structures, constants, and syscall numbers for interfacing with the Linux kernel on x86 architecture.

## Key Components

### Types and Structures
- `wchar_t` (L4): Wide character type as i32
- `stat` (L7-27): File status structure with device, inode, mode, ownership, size, and timestamps
- `stat64` (L29-49): 64-bit version of stat with identical layout
- `mcontext_t` (L51-53): Machine context for signal handling (opaque 22-element u32 array)
- `stack_t` (L55-59): Signal stack structure
- `ipc_perm` (L61-79): IPC permissions with conditional field naming based on musl version
- `shmid_ds` (L81-95): Shared memory segment descriptor
- `msqid_ds` (L97-112): Message queue descriptor
- `user_fpxregs_struct` (L116-130): x86 FPU extended registers for debugging
- `ucontext_t` (L132-139): User context for signal handling
- `max_align_t` (L141-144): Maximum alignment type (8-byte aligned)

### Trait Implementations
Custom PartialEq, Eq, and Hash implementations for `user_fpxregs_struct` (L149-185) and `ucontext_t` (L187-213) when "extra_traits" feature is enabled. These implementations skip private/padding fields.

### Constants

#### Signal Stack Sizes (L217-218)
- `SIGSTKSZ`: 8192 bytes
- `MINSIGSTKSZ`: 2048 bytes

#### File Operations (L220-304)
- O_DIRECT, O_DIRECTORY, O_NOFOLLOW flags
- File creation/access modes
- Memory mapping flags (MAP_*)
- File synchronization options

#### Terminal Control (L226-295)
Comprehensive terminal control flags including:
- Baud rates (B57600 through B4000000)
- Input/output processing flags
- Character size, parity, flow control
- Special character indices

#### Error Codes (L320-404)
Complete set of Linux errno values from EDEADLK (35) through EHWPOISON (133)

#### Signal Handling (L406-432)
Signal action flags and signal numbers including real-time signals

#### System Call Numbers (L460-870)
Complete x86 Linux syscall table from SYS_restart_syscall (0) to SYS_fchmodat2 (452). Includes deprecated syscalls with deprecation warnings.

#### Register Offsets (L873-889)
x86 register indices for ptrace/debugging: EBX through SS

## Architecture Notes
- x86-specific 32-bit layout with appropriate padding fields
- Musl libc compatibility with version-specific conditional compilation
- Extensive syscall coverage including modern additions like io_uring and landlock