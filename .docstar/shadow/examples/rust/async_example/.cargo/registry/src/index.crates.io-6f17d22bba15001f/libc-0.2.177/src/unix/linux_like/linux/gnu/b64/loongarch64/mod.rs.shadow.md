# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/loongarch64/mod.rs
@source-hash: f2d8b176c64d791a
@generated: 2026-02-09T17:57:09Z

## LoongArch64 GNU/Linux System Definitions

This module provides LoongArch64-specific type definitions, constants, and system call numbers for 64-bit GNU/Linux systems. It's part of the libc crate's platform-specific bindings hierarchy.

### Architecture Context
- **Target**: LoongArch64 (64-bit LoongArch architecture)
- **OS**: GNU/Linux 
- **ABI**: Little-endian and big-endian support via conditional compilation

### Key Type Definitions

**Basic Types (L4-10)**:
- `wchar_t = i32` - Wide character type
- `blksize_t = i32` - Block size type  
- `nlink_t = u32` - File link count type
- `suseconds_t = i64` - Microsecond time type
- `__u64/__s64` - 64-bit unsigned/signed types

**File System Structures (L12-132)**:
- `stat` (L13-33) - Standard file status structure with padding fields
- `stat64` (L35-55) - 64-bit file status structure using `off64_t`
- `statfs`/`statfs64` (L57-85) - File system statistics structures
- `flock`/`flock64` (L87-101) - File locking structures
- `statvfs`/`statvfs64` (L103-131) - VFS statistics structures

**Threading & Signal Handling (L133-221)**:
- `pthread_attr_t` (L133-135) - Thread attributes structure
- `sigaction` (L137-144) - Signal action structure with restorer function
- `stack_t` (L146-150) - Signal stack structure
- `siginfo_t` (L152-165) - Signal information with deprecated padding field
- `ucontext_t`/`mcontext_t` (L207-221) - User context structures for signal handling

**IPC & Memory Management (L167-244)**:
- `ipc_perm` (L167-178) - IPC permission structure
- `shmid_ds` (L180-191) - Shared memory segment descriptor
- `user_regs_struct`/`user_fp_struct` (L193-205) - LoongArch register structures
- `clone_args` (L224-236) - Modern clone() system call arguments
- `max_align_t` (L241-243) - Maximum alignment type (16-byte aligned)

### Threading Constants (L246-294)
Pthread object size definitions and mutex initializers with endian-specific variants:
- Size constants for various pthread objects (L246-251)
- Mutex initializers for recursive, error-check, and adaptive types with little/big-endian variants (L254-294)

### LoongArch Hardware Capabilities (L296-309)
Hardware capability flags specific to LoongArch architecture:
- CPU configuration, floating-point, vector extensions (LSX/LASX)
- Crypto, virtualization, and binary translation capabilities

### System Call Numbers (L311-611)
Comprehensive system call number definitions for LoongArch64, including:
- Standard POSIX syscalls (io, file operations, process management)
- Modern Linux syscalls (io_uring, landlock, etc.)
- Architecture-specific numbering scheme

### File & I/O Constants (L613-646)
POSIX file advisory constants, open flags, and file locking constants with octal values.

### Error Codes (L647-744)
Linux-specific error code definitions extending standard errno values.

### Memory & Signal Constants (L746-916)
- Memory mapping flags and memory locking constants
- Socket type definitions
- Signal handling flags and signal numbers
- Poll event flags
- Ptrace operation constants

### Terminal I/O (L817-916)
Comprehensive terminal control definitions:
- Control character indices and flags
- Baud rate constants (B0 through B4000000)
- Terminal mode flags for input/output processing

### Architectural Notes
- Supports both little-endian and big-endian byte orders via conditional compilation
- Uses LoongArch64-specific register layouts and hardware capabilities
- Includes architecture-specific padding and alignment requirements
- Maintains compatibility with GNU/Linux ABI standards