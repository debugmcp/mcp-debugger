# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/powerpc64/mod.rs
@source-hash: 285c465bd0cb1e66
@generated: 2026-02-09T17:57:13Z

## PowerPC64 GNU libc Platform Bindings

This file provides PowerPC64-specific type definitions, structure layouts, and system call constants for 64-bit GNU Linux systems. It forms part of the libc crate's platform-specific bindings layer for PowerPC64 architecture.

### Key Components

#### Type Definitions (L6-11)
- `wchar_t`: 32-bit signed integer (`i32`)
- `nlink_t`: 64-bit unsigned integer for link counts
- `blksize_t`: 64-bit signed integer for block sizes  
- `suseconds_t`: 64-bit signed integer for microsecond time values
- `__u64`/`__s64`: C unsigned/signed long mappings

#### Core System Structures (L13-194)

**Signal Handling (L16-23)**
- `sigaction`: Signal handler configuration with endian-aware layout
- Contains function pointer, signal mask, flags, and optional restorer

**File System Structures (L25-142)**
- `statfs`/`statfs64` (L25-39, L99-112): File system statistics with 32/64-bit variants
- `stat`/`stat64` (L57-76, L78-97): File metadata with nanosecond precision timestamps
- `statvfs`/`statvfs64` (L114-127, L129-142): POSIX file system information
- `flock`/`flock64` (L41-47, L49-55): File locking structures with offset type variations

**Threading & IPC (L144-172)**  
- `pthread_attr_t` (L144-146): Thread attributes as opaque 7x64-bit array
- `ipc_perm` (L148-159): System V IPC permissions structure
- `shmid_ds` (L161-172): Shared memory segment descriptor

**Signal Information (L174-187)**
- `siginfo_t`: Signal information with deprecated padding field
- Contains deprecation warning for `_pad` field referencing GitHub issue

**Stack Management (L189-193)**
- `stack_t`: Signal stack configuration

#### Special Alignment Structure (L196-201)
- `max_align_t`: 128-bit aligned type for maximum platform alignment

#### Constants & Flags (L203-964)

**File Operations (L213-224, L352-384)**
- POSIX advisory flags, file creation/access modes
- O_* flags for file operations with octal notation

**Memory Management (L226-235, L462-475)**  
- MAP_* flags for memory mapping operations
- MCL_* flags for memory locking

**Error Codes (L237-314)**
- Comprehensive errno constants for PowerPC64 platform
- Network and system-specific error codes

**Signal Constants (L319-347)**
- Signal action flags (SA_*)
- Signal numbers and masks specific to PowerPC64

**Terminal I/O (L374-570)**
- Extensive termios constants for serial communication
- Baud rates from 50 to 4M baud with octal encoding
- Control character indices and flags

#### System Call Table (L572-963)
Complete PowerPC64 system call number mappings from SYS_restart_syscall (0) to SYS_set_mempolicy_home_node (450), including:
- Process management, file operations, networking
- Modern syscalls like io_uring, landlock, futex_waitv
- Some deprecated syscalls marked with version notes

#### External Functions (L965-973)
- `sysctl`: BSD-style system control interface

### Architecture-Specific Features

**Endian Handling (L415-456)**
- Conditional pthread mutex initializers based on target endianness
- Separate definitions for little-endian and big-endian PowerPC64 systems

**PowerPC64 Specifics**
- Uses 64-bit addressing throughout structures
- Platform-specific signal stack sizes (16KB default, 4KB minimum)
- PowerPC64-specific syscalls like `spu_run`, `spu_create`, `switch_endian`