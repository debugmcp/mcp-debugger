# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/emscripten/lfs64.rs
@source-hash: 3a1d1779bcf16525
@generated: 2026-02-09T17:58:23Z

## Purpose
Provides Large File Support (LFS) 64-bit function aliases for Emscripten platform, mapping `*64` functions to their standard counterparts. This is a compatibility layer ensuring 64-bit file operations work correctly on Emscripten by delegating to the base implementations.

## Key Dependencies
- `crate::off64_t` (L1): 64-bit offset type used throughout file operations
- `crate::prelude::*` (L2): Standard types like `c_char`, `c_int`, `size_t`, `ssize_t`

## Architecture Pattern
All functions follow a consistent pattern: they are `#[inline]` wrapper functions that cast parameters as needed and delegate to the corresponding non-64 functions from the parent crate. This creates a zero-cost abstraction layer for LFS64 compatibility.

## Core Function Categories

### File Operations (L7-28)
- `creat64` (L7): Creates files, delegates to `crate::creat`
- `fopen64`/`freopen64` (L17, L22): File stream operations

### File Position Operations (L12-77)
- `fgetpos64`/`fsetpos64` (L12, L40): Position get/set with pointer casting
- `fseeko64`/`ftello64` (L31, L70): Seek/tell operations using `off64_t`
- `ftruncate64`/`truncate64` (L75, L209): File truncation
- `lseek64` (L85): File positioning

### File Status Operations (L45-67)
- `fstat64`/`lstat64`/`stat64` (L45, L90, L189): File status with struct casting
- `fstatat64` (L50): Status at directory descriptor
- `fstatfs64`/`statfs64` (L60, L194): Filesystem status
- `fstatvfs64`/`statvfs64` (L65, L199): VFS status

### Memory Mapping (L95-104)
- `mmap64` (L95): Memory mapping with 64-bit offset support

### Read/Write Operations (L130-167)
- `pread64`/`pwrite64` (L130, L150): Positioned I/O operations
- `preadv64`/`pwritev64` (L140, L160): Vectored I/O operations

### Directory Operations (L170-181)
- `readdir64`/`readdir64_r` (L170, L175): Directory reading with casting

### Resource Limits (L80-186)
- `getrlimit64`/`setrlimit64` (L80, L184): Resource limit management

### File Advice (L115-127)
- `posix_fadvise64`/`posix_fallocate64` (L115, L125): File access optimization

## Special Cases

### Variadic Function Aliases (L112)
Uses `pub use` to alias `open` as `open64` and `openat` as `openat64` because variadic extern "C" functions are unstable in Rust. These don't require LFS64-specific types.

### Platform Differences (L4)
Comment indicates this implementation differs from musl version in lacking `fallocate64`, `prlimit64`, and `sendfile64` functions.

## Critical Invariants
- All functions maintain C ABI compatibility with `extern "C"`
- All functions are marked `unsafe` as they operate on raw pointers
- Consistent parameter casting pattern: `as *mut _` for struct pointer conversions
- Zero-cost abstraction through `#[inline]` attribute on all functions