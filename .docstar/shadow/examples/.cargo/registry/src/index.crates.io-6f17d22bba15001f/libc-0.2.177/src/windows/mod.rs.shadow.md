# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/windows/mod.rs
@source-hash: 455795a86354420b
@generated: 2026-02-09T18:06:41Z

Primary purpose: Provides Windows-specific C runtime library (CRT) bindings for the libc crate, defining types, constants, structures, and external function declarations that mirror the Windows C standard library.

## Core Type Definitions (L5-42)
- Basic integer types: `intmax_t`, `uintmax_t`, `size_t`, `ptrdiff_t`, `intptr_t`, `uintptr_t`, `ssize_t` (L5-12)
- Windows-specific types: `wchar_t` as u16, `sighandler_t` as usize (L13-15) 
- Time types: `clock_t`, `time_t` (architecture-dependent via cfg_if), `time64_t` (L17-40)
- File system types: `off_t`, `dev_t`, `ino_t` (L29-31)
- Socket type: `SOCKET` as `crate::uintptr_t` (L42)

## Key Structures (L44-92)
Defined within `s!` macro for proper C layout:
- `stat` (L46-58): File status structure corresponding to Windows `stat64`
- `utimbuf` (L61-64): File time modification, corresponds to Windows `utimbuf64`
- `tm` (L66-76): Time structure for broken-down time representation
- `timeval` (L78-81): Time value with microsecond precision
- `timespec` (L83-86): Time specification with nanosecond precision
- `sockaddr` (L88-91): Socket address structure

## Opaque Types (L32-39, L254-269)
- `timezone` (L32-39): Empty enum with Copy/Clone implementations
- `FILE` (L254-261): Empty enum representing file handle
- `fpos_t` (L262-269): File position type (marked as incomplete with FIXME)

## Constants (L94-245)
Comprehensive set of C standard library constants:
- Integer limits: `INT_MIN`, `INT_MAX` (L94-95)
- Program exit codes: `EXIT_SUCCESS`, `EXIT_FAILURE` (L97-98)
- File operation constants: stdio buffering modes, file limits (L99-109)
- File control flags: open modes, text/binary flags (L111-131)
- File permissions: stat mode flags (L132-139)
- Locale categories (L140-146)
- Error codes: standard errno values and POSIX supplement (L147-229)
- Signal constants (L230-245)

## External Function Declarations
Multiple extern blocks with different calling conventions:

### Conditional Print Functions (L271-283)
Special handling for printf/fprintf with feature-gated inclusion and MSVC-specific linking.

### Standard C Library Functions (L285-559)
- Character classification: `isalnum`, `isalpha`, etc. (L286-299)
- Sorting: `qsort`, `qsort_s` (L300-312)
- File I/O: comprehensive stdio functions (L313-339)
- String conversion: `atof`, `strtod` family (L340-349)
- Memory management: `malloc`, `calloc`, `realloc`, `free` (L350-354)
- Program control: `exit`, `abort`, `system` (L355-360)
- String operations: complete string.h functions (L362-383)
- Memory operations: `memcpy`, `memset`, etc. (L385-389)
- Math utilities: `abs`, `rand` (L391-394)
- Signal handling (L396-397)
- Time functions with Windows-specific `_time64` linking (L399-422)
- File system operations with Windows prefixed names (L423-559)

### Windows Socket Functions (L561-599)
System calling convention for Winsock API: `listen`, `accept`, `bind`, `connect`, socket options, and data transfer functions.

## Conditional Compilation (L601-611)
Platform-specific module inclusion:
- GNU environment: includes `gnu` module
- MSVC environment: includes `msvc` module
- Fallback for unknown environments

## Architecture Dependencies
- `time_t` size varies: i32 for x86 GNU, i64 otherwise (L21-27)
- Extensive use of Windows-specific function name prefixes (`_` prefix)
- MSVC-specific library linking directives (L249-252)

## Key Design Patterns
- Uses `cfg_if!` macro for conditional compilation
- Leverages `s!` macro for C-compatible struct layout
- Implements Copy/Clone for opaque types via empty enums
- Extensive use of `#[link_name]` attributes for Windows API mapping
- Feature-gated compilation for different use contexts