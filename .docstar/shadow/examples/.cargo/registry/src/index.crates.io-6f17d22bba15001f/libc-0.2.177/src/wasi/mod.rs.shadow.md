# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/wasi/mod.rs
@source-hash: 2d15648f99fe90cf
@generated: 2026-02-09T18:06:32Z

This file defines the core WASI libc bindings for WebAssembly System Interface, providing C standard library types, structures, constants, and function declarations for WASI environments.

## Primary Purpose
Provides Rust bindings to the wasi-libc C standard library, enabling Rust code to interface with WASI runtime environments. Contains type definitions, system constants, and external function declarations that mirror the C standard library API.

## Key Type Definitions (L10-35)
- Standard C integer types: `intmax_t`, `uintmax_t`, `size_t`, `ssize_t`, etc.
- WASI-specific types: `__wasi_rights_t` (L34), `locale_t` (L35)
- Time-related types: `time_t`, `clock_t` (L19-20)
- File system types: `ino_t`, `mode_t`, `dev_t`, `uid_t`, `gid_t` (L21-28)

## Key Structures
- **max_align_t** (L38-42): 16-byte aligned structure for memory alignment
- **clockid_t** (L54-60): Transparent wrapper around pointer for clock IDs with Send/Sync traits (L62-63)
- **Time structures**:
  - `tm` (L71-84): Standard time structure with timezone fields
  - `timeval` (L86-89), `timespec` (L91-94): Time value representations
  - `itimerspec` (L103-106): Timer specification
- **File system structures**:
  - `stat` (L151-167): File status structure
  - `dirent` (L177-187): Directory entry with flexible array member workaround
- **I/O structures**:
  - `iovec` (L108-111): Vector I/O structure
  - `pollfd` (L140-144): Poll file descriptor structure
  - `fd_set` (L169-172): File descriptor set for select()

## Opaque Types (L44-52)
- `FILE`, `DIR`, `__locale_struct`: Empty enums representing C library opaque types

## System Constants
- **File operations**: O_* flags (L206-223), F_* flags (L200-204)
- **File permissions**: S_* mode constants (L237-259)
- **Error codes**: Complete POSIX error code definitions (L280-357)
- **Standard I/O**: STDIN/STDOUT/STDERR file descriptors (L191-193)
- **Locale constants**: NL_* langinfo items (L376-439)

## Function Implementations (L441-461)
- **FD_ISSET** (L442-446): Checks if file descriptor is in set
- **FD_SET** (L448-455): Adds file descriptor to set
- **FD_ZERO** (L457-460): Clears file descriptor set

## External C Function Declarations (L476-846)
Extensive extern "C" block containing:
- Memory management: malloc, free, realloc, etc. (L480-487)
- File I/O: fopen, fread, fwrite, etc. (L496-521)
- String operations: strcpy, strcmp, strlen, etc. (L580-601)
- System calls: open, read, write, stat, etc. (L625-675)
- Time functions: clock, time, gmtime, etc. (L531-541)
- WASI-specific functions: `__wasilibc_*` functions (L751-844)

## Clock Constants (L366-374)
Static clock ID constants using unsafe addr_of! macro to reference external symbols.

## Conditional Compilation (L848-853)
Includes p2 module for non-p1 target environments using cfg_if macro.

## Architecture Notes
- Uses macro-generated structs (`s!`, `s_no_extra_traits!`, `s_paren!`) for consistent trait implementations
- Handles WASI's opaque struct pattern for clockid_t with transparent wrapper
- Implements flexible array member workaround in dirent struct
- Provides both standard POSIX and WASI-specific function bindings