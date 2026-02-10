# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/riscv32/mod.rs
@source-hash: f13543de5c3b4f8c
@generated: 2026-02-09T17:57:15Z

## RISC-V 32-bit musl Linux Platform-Specific Definitions

**Primary Purpose**: Platform-specific type definitions, constants, and syscall mappings for 32-bit RISC-V architecture running Linux with musl libc.

### Key Type Definitions

**wchar_t Type** (L6): Defines wide character type as `c_int` for RISC-V 32-bit.

**Core System Structures** (L8-102):
- `stat` (L9-29): File status structure with standard POSIX fields, uses `off_t` for file size
- `stat64` (L31-51): 64-bit file status structure, uses `off64_t` and `ino64_t` for large file support
- `stack_t` (L53-57): Signal stack structure for alternate signal handling
- `ipc_perm` (L59-71): Inter-process communication permissions structure
- `shmid_ds` (L73-84): Shared memory segment descriptor
- `msqid_ds` (L86-101): Message queue descriptor with padding fields for alignment

**Memory Alignment** (L104-109): `max_align_t` with 8-byte alignment using i64/f64 tuple.

### Platform Constants

**File Operation Flags** (L118-126): O_* constants for file operations (APPEND, CREAT, SYNC, etc.)
**Memory Mapping** (L126, 244-258): MAP_* constants including RISC-V specific values
**Error Codes** (L127-205): Comprehensive errno definitions matching Linux error constants
**Socket Types** (L207-208): Basic socket type definitions
**Signal Handling** (L209-234): SA_* signal action flags and SIG_* signal manipulation constants
**Signal Numbers** (L212-231): Platform-specific signal number assignments
**Terminal Control** (L268-342): Extensive tcflag_t constants for terminal I/O control including baud rates and control flags

### System Call Numbers

**Core Syscalls** (L344-636): Comprehensive mapping of syscall names to numbers for RISC-V 32-bit, including:
- File operations (read, write, close, lseek)
- Memory management (mmap, mprotect, brk)
- Process control (clone, execve, kill)
- Signal handling (rt_sig* family)
- IPC operations (shm*, msg*, sem*)
- Time-related syscalls with time64 variants

**Time64 Syscall Aliases** (L637-655): Maps standard time-related syscall names to their 64-bit time variants, addressing Y2038 compatibility.

### Architecture-Specific Notes

- Missing traditional syscalls (fstat, wait4, gettimeofday) - uses newer alternatives
- Extensive use of time64 variants for future-proofing
- RISC-V specific memory alignment and padding requirements
- Platform-optimized constant values for performance