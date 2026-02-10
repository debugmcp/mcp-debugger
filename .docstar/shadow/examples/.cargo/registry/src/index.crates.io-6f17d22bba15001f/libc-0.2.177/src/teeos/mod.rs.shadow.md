# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/teeos/mod.rs
@source-hash: d03cf399183ac40c
@generated: 2026-02-09T18:06:34Z

## Purpose
Libc bindings module for TeeOS - a TEE (Trusted Execution Environment) operating system. Provides C standard library FFI bindings including type definitions, constants, and function declarations for system calls, threading, memory management, and standard library functions.

## Key Type Definitions
- **C primitive type aliases (L10-29)**: Maps Rust types to C equivalents (`c_bool`, `intmax_t`, `size_t`, etc.)
- **`_CLongDouble` struct (L64-65)**: 16-byte aligned wrapper for C long double (128-bit float)
- **pthread types (L69-98)**: Opaque structs for threading primitives using byte arrays sized by constants
- **Standard C structs (L105-147)**: Time structures (`timespec`, `timeval`, `tm`), semaphores (`sem_t`), division result (`div_t`)

## Constants by Category

### File Control (L149-216)
- File creation/access flags (`O_CREAT`, `O_APPEND`, etc.) 
- File control commands (`F_DUPFD`, `F_GETFD`, etc.)

### Memory Management (L218-321)
- Memory mapping flags (`MAP_SHARED`, `MAP_PRIVATE`, `MAP_HUGE_*` sizes)
- Memory protection (`PROT_READ`, `PROT_WRITE`, `PROT_EXEC`)
- Memory sync flags (`MS_ASYNC`, `MS_SYNC`)

### Error Codes (L372-639)
- POSIX errno values (1-133) including networking errors
- Aliases like `EWOULDBLOCK = EAGAIN` (L453), `EDEADLOCK = EDEADLK` (L487)

### Threading Constants (L364-976)
- pthread structure sizes (`__SIZEOF_PTHREAD_*`)
- Mutex types and initialization values
- TeeOS-specific thread attributes (`TEESMP_THREAD_ATTR_*`)

### System Configuration (L652-934)
- `sysconf()` parameter constants (`_SC_*` values)
- Thread limits and capabilities

## External Functions (L977-1337)
Comprehensive C library bindings organized by functionality:

- **Memory management (L979-1001)**: `malloc`, `free`, `memcpy`, etc.
- **Threading (L1004-1121)**: Full pthread API including TeeOS extension `pthread_attr_settee`
- **I/O (L1123-1133)**: Basic stdio functions (`printf`, `scanf`, `snprintf`)
- **System calls (L1143-1173)**: Process info, time, memory mapping
- **String/character processing (L1227-1275)**: Standard string and wide character functions
- **Math functions (L1277-1301)**: Basic floating point operations
- **Standard library (L1304-1336)**: Parsing, searching, sorting utilities

## Utility Functions
- **`errno()` (L1339-1341)**: Safe wrapper for errno access via `__errno_location()`
- **CPU set utilities (L1343-1355)**: `CPU_COUNT` and `CPU_COUNT_S` for counting set bits in CPU affinity masks

## Architecture Notes
- Uses opaque byte arrays for pthread types to match C ABI without exposing internals
- TeeOS-specific extensions like `pthread_attr_settee` for TEE environment configuration
- Comprehensive errno coverage including Linux-specific and networking error codes
- Long double handling acknowledges x86 vs PowerPC differences with custom aligned wrapper
- Memory mapping constants include huge page support for various sizes (16KB to 16GB)