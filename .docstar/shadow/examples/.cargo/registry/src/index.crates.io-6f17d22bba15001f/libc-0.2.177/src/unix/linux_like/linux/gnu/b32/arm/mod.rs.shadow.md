# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/arm/mod.rs
@source-hash: 0ab9b524f4e4182e
@generated: 2026-02-09T17:57:11Z

## Primary Purpose
This file defines ARM 32-bit (armv7) specific type definitions, constants, and syscall numbers for Linux GNU libc bindings. It's part of the libc crate's architecture-specific implementation hierarchy: `unix/linux_like/linux/gnu/b32/arm/`.

## Key Type Definitions

### Core System Structures
- **wchar_t** (L4): 32-bit wide character type (`u32`)
- **sigaction** (L9-14): Signal handler structure with ARM-specific `sa_restorer` field
- **statfs/statfs64** (L16-31, L97-110): Filesystem statistics structures, with 64-bit variant using `u64` for counters
- **flock/flock64** (L33-47): File locking structures using `off_t`/`off64_t`

### IPC Structures  
- **ipc_perm** (L49-61): Inter-process communication permissions with ARM-specific padding
- **shmid_ds** (L128-145): Shared memory segment descriptor with conditional `gnu_time_bits64` fields
- **msqid_ds** (L147-165): Message queue descriptor with glibc reserved fields

### File System & Statistics
- **stat64** (L63-95): 64-bit file statistics with complex conditional compilation for `gnu_time_bits64` feature
- **statvfs64** (L112-126): VFS statistics structure for 64-bit filesystems

### ARM-Specific Structures
- **mcontext_t** (L188-210): Machine context containing all ARM registers (r0-r10, fp, ip, sp, lr, pc, cpsr)
- **user_regs** (L212-231): User-space register structure including `arm_orig_r0`
- **ucontext_t** (L241-248): User context with 128-entry register space array
- **max_align_t** (L236-238): 8-byte aligned type for memory alignment

## Constants & Values

### File Operations (L275-293)
- File descriptor flags: `O_DIRECT`, `O_DIRECTORY`, `O_LARGEFILE`, etc.
- POSIX file creation/access modes

### Memory Management (L295-307) 
- Memory mapping flags: `MAP_LOCKED`, `MAP_HUGETLB`, `MAP_SYNC`, etc.
- ARM-specific memory advice: `MADV_SOFT_OFFLINE`

### Error Codes (L309-392)
Comprehensive Linux error number definitions from `EDEADLOCK` to `ERFKILL`

### Signal Handling (L394-446)
- Signal action flags, socket types, memory locking constants
- Terminal control flags and baud rates (B0 through B4000000)

### Extensive Syscall Table (L546-928)
Complete ARM Linux syscall numbers from `SYS_restart_syscall` (0) through `SYS_mseal` (462), including modern additions like io_uring and landlock.

## Architecture-Specific Features

### Conditional Compilation
- **gnu_time_bits64**: Affects time field layout in stat64, shmid_ds, msqid_ds
- **gnu_file_offset_bits64**: Changes F_GETLK constant value (L408-413)
- **extra_traits**: Enables PartialEq/Hash implementations for ucontext_t (L252-273)

### ARM Register Layout
Complete ARM register mapping in mcontext_t and user_regs preserving ARM calling convention and debugging interfaces.

## Dependencies
- Uses crate prelude and imports `off64_t`, `off_t` types
- Relies on parent module type definitions via `crate::`
- Integrates with cfg_if! macro for conditional compilation