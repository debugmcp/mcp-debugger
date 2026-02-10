# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/lfs64.rs
@source-hash: 308c5b5c9b2f4b1a
@generated: 2026-02-09T17:57:20Z

## File Purpose
Provides LFS64 (Large File Support 64-bit) compatibility shims for musl libc. This module acts as a bridge layer that forwards 64-bit function calls to their standard counterparts, since musl inherently uses 64-bit types where glibc distinguishes between 32-bit and 64-bit variants.

## Key Dependencies
- `crate::off64_t` (L1): 64-bit offset type for file operations
- `crate::prelude::*` (L2): Common type aliases (c_int, c_char, size_t, ssize_t, c_void)

## Architecture Pattern
All functions follow the same shim pattern:
1. Accept 64-bit suffixed function signature
2. Forward directly to non-suffixed equivalent in `crate::`
3. Cast pointer types when necessary (`as *mut _`)
4. Maintain identical C ABI compatibility with `unsafe extern "C"`

## Function Categories

### File Creation/Access (L5-36)
- `creat64()` (L5-7): File creation wrapper
- `fopen64()`, `freopen64()` (L25-36): File stream opening wrappers

### File I/O Operations (L38-95, 138-185)
- Position functions: `fseeko64()`, `fsetpos64()`, `ftello64()` (L38-80)
- Read/write: `pread64()`, `pwrite64()`, `preadv64()`, `pwritev64()` (L138-185)
- Seek: `lseek64()` (L93-95)
- Memory mapping: `mmap64()` (L103-112)

### File Status/Metadata (L53-75, 98-100, 217-229)
- Stat functions: `fstat64()`, `fstatat64()`, `lstat64()`, `stat64()` (L53-65, L98-100, L217-219)
- Filesystem info: `fstatfs64()`, `fstatvfs64()`, `statfs64()`, `statvfs64()` (L68-75, L222-229)

### Resource Management (L88-90, 158-165, 212-214)
- Limit functions: `getrlimit64()`, `prlimit64()`, `setrlimit64()` (L88-90, L158-165, L212-214)

### Special Cases
- `open64`, `openat64` (L120): Re-exported as aliases due to variadic C ABI limitations
- Directory operations: `readdir64()`, `readdir64_r()` (L188-199)

## Notable Constraints
- All functions marked `#[inline]` for zero-cost abstraction
- Pointer casting pattern (`buf as *mut _`) used consistently for type compatibility
- Variadic functions cannot be shimmed due to Rust limitations (L114-119)
- Maintains unsafe C ABI contracts without additional safety checks