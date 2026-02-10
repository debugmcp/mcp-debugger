# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/trusty.rs
@source-hash: c5012aeefc4307c1
@generated: 2026-02-09T18:11:33Z

## Trusty OS Platform-Specific C FFI Bindings

This file provides C FFI (Foreign Function Interface) bindings and type definitions specifically for the Trusty operating system, which is a secure OS for embedded devices. It serves as a bridge between Rust code and Trusty's C system interface.

### Type Definitions (L2-23)
- **Basic size types**: `size_t` (usize), `ssize_t` (isize), `off_t` (i64) for representing sizes and offsets
- **Fixed-width integer types**: Complete set of signed (`c_int8_t` through `c_int64_t`) and unsigned (`c_uint8_t` through `c_uint64_t`) C-compatible integer types
- **Pointer types**: `intptr_t` (isize), `uintptr_t` (usize) for pointer arithmetic
- **Time types**: `time_t` (c_long), `clockid_t` (c_int) for time operations

### Structures (L24-34)
- **`iovec` (L25-28)**: I/O vector structure for scatter-gather I/O operations with base pointer and length
- **`timespec` (L30-33)**: Time specification structure with seconds and nanoseconds fields

### Constants (L36-47)
- **Memory protection**: `PROT_READ`, `PROT_WRITE` flags for memory mapping
- **Clock types**: `CLOCK_BOOTTIME` (7) - notably, Trusty only supports boottime clock
- **File descriptors**: Standard output (`STDOUT_FILENO`) and error (`STDERR_FILENO`) descriptors
- **System info**: `AT_PAGESZ` for auxiliary vector page size queries
- **Memory mapping**: `MAP_FAILED` constant for failed mmap operations

### External C Functions (L49-72)
- **Memory management (L50-55)**: Standard allocator functions (`malloc`, `calloc`, `realloc`, `free`) plus alignment-specific allocators (`memalign`, `posix_memalign`)
- **I/O operations (L56-58)**: File writing functions (`write`, `writev`) and file closing (`close`)
- **String operations (L59)**: String length calculation (`strlen`)
- **System queries (L60)**: Auxiliary vector value retrieval (`getauxval`)
- **Memory mapping (L61-69)**: Virtual memory management (`mmap`, `munmap`)
- **Time operations (L70-71)**: Clock and sleep functions (`clock_gettime`, `nanosleep`)

### Dependencies
- Imports from `crate::prelude::*` for common types
- References `crate::iovec`, `crate::clockid_t`, and `crate::timespec` in function signatures, indicating cross-module type sharing

### Architectural Notes
- Trusty-specific limitation: Only supports `CLOCK_BOOTTIME` for clock operations
- Uses standard C calling convention (`extern "C"`) for all system calls
- Provides minimal but essential system interface for embedded/secure environment