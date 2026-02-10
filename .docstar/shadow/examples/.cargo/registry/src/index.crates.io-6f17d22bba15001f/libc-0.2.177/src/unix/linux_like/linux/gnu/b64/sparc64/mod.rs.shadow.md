# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/sparc64/mod.rs
@source-hash: ef87054c07622d4f
@generated: 2026-02-09T17:57:15Z

Platform-specific definitions for SPARC64 architecture on 64-bit Linux GNU systems. Part of the libc crate's hierarchical type system providing low-level C bindings.

## Core Responsibility
Defines SPARC64-specific primitive types, system structures, constants, and external functions that differ from generic Linux implementations. Acts as the architecture-specific leaf in the libc type hierarchy.

## Key Type Definitions

**Primitive Types (L6-11)**
- `wchar_t = i32` - Wide character type for SPARC64
- `nlink_t = u32` - File link count type  
- `blksize_t = i64` - Block size type
- `suseconds_t = i32` - Microseconds type
- `__u64 = c_ulonglong`, `__s64 = c_longlong` - Low-level 64-bit integer types

**System Structures (L13-197)**

Critical structures defined in `s!` macro block:
- `sigaction` (L16-23) - Signal handling configuration with SPARC64-specific reserved field
- `statfs`/`statfs64` (L25-39, L123-136) - Filesystem statistics with different field sizes
- `siginfo_t` (L41-54) - Signal information with deprecated `_pad` field
- `flock`/`flock64` (L56-71) - File locking structures for 32/64-bit offsets
- `stat`/`stat64` (L79-121) - File status structures with architecture-specific padding
- `statvfs`/`statvfs64` (L138-166) - VFS statistics structures
- `pthread_attr_t` (L168-170) - Thread attributes (7x u64 array)
- `ipc_perm` (L172-183) - IPC permissions structure
- `shmid_ds` (L185-196) - Shared memory segment descriptor

**Special Alignment Structure (L199-204)**
- `max_align_t` - 16-byte aligned type for maximum alignment requirements

## Constants and Values

**File Operations (L206-227)**
- POSIX advisory flags, RTLD dynamic linking flags, file open flags with SPARC64-specific values

**Memory Management (L229-239)**  
- Memory mapping flags (`MAP_*`) and memory advice (`MADV_*`) constants

**Error Codes (L241-318)**
- Comprehensive errno values specific to SPARC64 Linux

**Signal Handling (L320-349)**
- Socket types, signal action flags, signal numbers with SPARC64-specific mappings

**System Call Numbers (L548-919)**
- Complete syscall table mapping syscall names to SPARC64-specific numbers
- Includes deprecated syscalls with deprecation annotations (L713-714, L751-755)

**Terminal Control (L376-546)**
- Terminal I/O constants, baud rates, and control flags
- SPARC64-specific values for termios functionality

## External Functions

**sysctl Interface (L921-930)**
- `sysctl()` function declaration for system parameter access
- Standard BSD-style sysctl interface

## Architectural Notes

- Uses conditional compilation `#[cfg(target_arch = "sparc64")]` for architecture-specific fields
- Structures include explicit padding fields (`__pad*`, `__reserved*`) for binary compatibility
- Some fields marked as `#[doc(hidden)]` and deprecated for API evolution
- Syscall numbers reflect SPARC64's unique system call numbering scheme
- Binary layout designed for compatibility with SPARC64 GNU libc