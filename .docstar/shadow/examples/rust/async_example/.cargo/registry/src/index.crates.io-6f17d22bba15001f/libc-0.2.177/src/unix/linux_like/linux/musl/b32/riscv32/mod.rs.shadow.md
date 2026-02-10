# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/riscv32/mod.rs
@source-hash: f13543de5c3b4f8c
@generated: 2026-02-09T17:57:00Z

## RISC-V 32-bit musl libc System Definitions

This module provides RISC-V 32-bit architecture-specific definitions for Linux-like systems using musl libc. It defines platform-specific data structures, constants, and system call numbers.

### Key Components

**Type Definitions (L6):**
- `wchar_t = c_int` - Wide character type for RISC-V 32-bit

**Core Data Structures (L8-102):**
- `stat` (L9-29) - File status structure with standard Unix fields including device, inode, mode, size, timestamps with nanosecond precision
- `stat64` (L31-51) - 64-bit variant using `off64_t` for file size and `ino64_t` for inode numbers
- `stack_t` (L53-57) - Signal stack structure with pointer, flags, and size
- `ipc_perm` (L59-71) - IPC permission structure for shared memory/message queues
- `shmid_ds` (L73-84) - Shared memory segment descriptor
- `msqid_ds` (L86-101) - Message queue descriptor
- `max_align_t` (L105-108) - Maximum alignment type with 8-byte alignment

### Constants and Values

**File Operations (L112-126):**
- File control flags: `O_APPEND`, `O_CREAT`, `O_EXCL`, `O_NONBLOCK`, `O_SYNC`, etc.
- Memory mapping: `MAP_GROWSDOWN`, `MAP_HUGETLB`, `MAP_LOCKED`, etc. (L126, 249-258)

**Error Codes (L127-205):**
- Comprehensive errno definitions from `EDEADLK` (35) to `ERFKILL` (132)
- Network and socket error codes (L164-193)
- System-specific errors (L194-205)

**Socket and Signal Constants (L207-342):**
- Socket types: `SOCK_STREAM`, `SOCK_DGRAM`
- Signal handling: `SA_ONSTACK`, `SA_SIGINFO`, signal numbers
- Terminal I/O control flags and baud rates (L235-342)

**System Call Numbers (L344-655):**
- Complete RISC-V system call table mapping symbolic names to numbers
- Time64 variants for newer kernel interfaces (L500, 516-523, 637-655)
- Architecture-specific adaptations noting missing syscalls (L347, 392, 415, 469, 550)

### Architecture Notes

This is specifically for RISC-V 32-bit architecture running on musl libc. Several traditional syscalls are replaced with newer variants:
- No `SYS_fstat`, uses `statx` instead (L347)
- No `wait4`, uses `waitid` instead (L392)  
- Time-related syscalls use time64 variants for Y2038 compatibility

The module imports core types from parent modules and defines platform-specific layouts matching the RISC-V 32-bit ABI and musl libc conventions.