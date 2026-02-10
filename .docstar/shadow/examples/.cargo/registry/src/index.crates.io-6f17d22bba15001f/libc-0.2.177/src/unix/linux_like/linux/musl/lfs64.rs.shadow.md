# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/lfs64.rs
@source-hash: 308c5b5c9b2f4b1a
@generated: 2026-02-09T18:02:22Z

## libc LFS64 Compatibility Layer for musl

This file provides Large File Support (LFS64) compatibility wrappers for the musl C library on Linux systems. Musl natively supports 64-bit file operations, so these functions serve as thin forwarding layers to the standard library functions.

### Primary Purpose
Implements LFS64 API compatibility by aliasing 64-bit file operation functions to their musl equivalents, enabling portable code that expects explicit 64-bit file handling functions to work seamlessly with musl's unified interface.

### Key Function Categories

**File Creation & Opening (L5-36)**
- `creat64()` (L5-7): Creates files, forwards to `crate::creat`
- `fopen64()` (L25-27): Opens files for streaming, forwards to `crate::fopen`  
- `freopen64()` (L30-36): Reopens file streams, forwards to `crate::freopen`

**File Positioning & Seeking (L39-80)**
- `fseeko64()` (L39-45): Stream seeking with 64-bit offsets
- `fsetpos64()`/`fgetpos64()` (L20-22, L48-50): Stream position management
- `ftello64()` (L78-80): Returns current stream position
- `lseek64()` (L93-95): File descriptor seeking

**File Statistics & Information (L53-75)**
- `fstat64()`, `lstat64()`, `stat64()` (L53-55, L98-100, L217-219): File status operations
- `fstatat64()` (L58-65): File status with directory descriptor
- `fstatfs64()`/`statfs64()` (L68-70, L222-224): Filesystem statistics
- `fstatvfs64()`/`statvfs64()` (L73-75, L227-229): VFS statistics

**File I/O Operations (L138-185)**
- `pread64()`/`pwrite64()` (L138-145, L168-175): Positioned read/write operations
- `preadv64()`/`pwritev64()` (L148-155, L178-185): Vectored positioned I/O
- `sendfile64()` (L202-209): Efficient file-to-socket transfer

**Memory Management & Allocation (L10-17, L83-85, L103-112)**
- `fallocate64()` (L10-17): File space allocation
- `ftruncate64()`/`truncate64()` (L83-85, L237-239): File truncation
- `mmap64()` (L103-112): Memory mapping with 64-bit offsets

**Resource Limits (L88-90, L158-165, L212-214)**
- `getrlimit64()`/`setrlimit64()` (L88-90, L212-214): Resource limit management
- `prlimit64()` (L158-165): Process resource limits

**Directory Operations (L188-199)**
- `readdir64()` (L188-190): Directory entry reading
- `readdir64_r()` (L193-199): Thread-safe directory reading

**Special Aliases (L120)**
- `open64`/`openat64` aliased directly to standard functions due to variadic nature

### Dependencies
- `crate::off64_t`: 64-bit offset type
- `crate::prelude::*`: Common libc types (c_int, c_char, size_t, etc.)
- Various crate-level types: FILE, stat64, rlimit64, dirent64, etc.

### Architectural Pattern
All functions follow the same pattern:
1. Accept LFS64 function signature with explicit 64-bit types
2. Forward to musl's standard function (which already handles 64-bit operations)
3. Perform type casting where necessary (typically `as *mut _`)
4. Marked as `#[inline]` and `unsafe extern "C"` for zero-cost FFI compatibility

### Critical Constraints
- Functions maintain C ABI compatibility with standard LFS64 interface
- Pointer casting assumes compatible memory layouts between 64-bit types
- All functions are unsafe and require caller to ensure memory safety
- Variadic functions (open64, openat64) cannot be shimmed directly in Rust