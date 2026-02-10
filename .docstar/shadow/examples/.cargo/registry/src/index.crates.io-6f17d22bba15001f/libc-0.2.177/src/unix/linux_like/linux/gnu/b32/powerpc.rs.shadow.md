# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/powerpc.rs
@source-hash: 7c3b9aad88564085
@generated: 2026-02-09T17:58:21Z

## PowerPC 32-bit Linux GNU libc Bindings

Platform-specific definitions for PowerPC 32-bit architecture on Linux with GNU libc. This file provides C-compatible FFI bindings for system structures, constants, and syscall numbers.

### Key Components

**Type Definitions (L4)**
- `wchar_t` defined as `i32` for PowerPC 32-bit

**Core System Structures (L6-221)**
- `sigaction` (L9-14): Signal handler configuration with PowerPC-specific layout
- `statfs` (L16-31): File system statistics structure 
- `flock`/`flock64` (L33-47): File locking structures for 32/64-bit file offsets
- `ipc_perm` (L49-60): IPC permissions structure with glibc-specific padding
- `stat`/`stat64` (L62-124): File metadata structures with conditional time field padding based on `gnu_time_bits64`
- `statfs64`/`statvfs64` (L126-155): 64-bit file system statistics
- `shmid_ds`/`msqid_ds` (L157-199): Shared memory and message queue control structures
- `siginfo_t` (L201-214): Signal information with deprecated `_pad` field
- `stack_t` (L216-220): Signal stack configuration

**System Constants (L223-489)**
- Terminal control constants (`VEOF`, `TCSANOW`, etc.)
- Dynamic linker flags (`RTLD_*`)
- File operation flags (`O_*`) with PowerPC-specific values
- Memory mapping flags (`MAP_*`, `MADV_*`)
- Error codes (`E*`) - extensive PowerPC errno definitions
- Signal constants (`SIG*`, `SA_*`) 
- Socket types and memory control flags
- Terminal I/O control flags and baud rates

**System Call Numbers (L491-892)**
Complete PowerPC syscall table from basic operations (exit=1, fork=2) through modern syscalls (mseal=462). Includes deprecated syscalls marked with deprecation warnings.

### Architecture Notes

- Uses conditional compilation with `gnu_file_offset_bits64` and `gnu_time_bits64` feature flags
- PowerPC-specific padding and alignment in structures
- Maintains ABI compatibility with glibc on PowerPC 32-bit
- Comprehensive syscall coverage including PowerPC-specific calls like `subpage_prot` (L802)

### Dependencies
- Imports from crate prelude and `off_t`/`off64_t` types
- References various crate types (`sighandler_t`, `fsblkcnt_t`, etc.)