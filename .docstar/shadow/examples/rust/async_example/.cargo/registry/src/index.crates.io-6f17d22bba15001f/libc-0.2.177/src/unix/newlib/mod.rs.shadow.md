# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/newlib/mod.rs
@source-hash: 18def44ab6d32cc5
@generated: 2026-02-09T18:02:46Z

**Primary Purpose**: Newlib C library type definitions and constants for Unix-like systems

This module defines C-compatible types, structures, and constants for newlib C library implementations across various embedded and Unix-like targets (ESP-IDF, PlayStation Vita, Nintendo 3DS, RTEMS, etc.).

**Key Type Definitions**:
- **Platform-specific types (L3-65)**: Basic C types with conditional compilation based on target OS
  - File system types: `dev_t`, `ino_t`, `off_t` (L8-22)
  - Time types: `time_t` (L56-65), `clockid_t` (L6)
  - Socket types: `sa_family_t` (L36-42), `socklen_t` (L44)
  - Thread types: `pthread_t`, `pthread_key_t` (L32-33)

**Key Structures**:
- **Network structures (L82-118)**:
  - `addrinfo` (L85-104): Address info with target-specific field ordering
  - `ip_mreq` (L106-109): IP multicast request
  - `in_addr` (L116-118): IPv4 address
- **System structures (L120-352)**:
  - `pollfd` (L120-124): File descriptor polling
  - `lconv` (L126-151): Locale convention
  - `tm` (L153-163): Time structure
  - `sigaction` (L179-183): Signal action
  - `pthread_*` structures (L249-351): Threading primitives with alignment attributes

**Constants (L354-863)**:
- **Error codes (L437-521)**: Standard POSIX errno values
- **File operations (L523-556)**: fcntl flags and open modes
- **Socket options (L594-771)**: Network configuration constants
- **Process priorities (L834-836)**: Process scheduling priorities

**Function Macros (L838-864)**:
- **FD_* macros (L839-863)**: File descriptor set manipulation functions

**External Functions (L866-962)**:
- System calls and library functions with platform-specific link names
- Threading functions, socket operations, time functions

**Platform Support**:
- Conditional compilation for: ESP-IDF, PlayStation Vita, Nintendo 3DS (horizon), RTEMS
- Architecture-specific modules: ARM, AArch64, PowerPC (L964-990)
- Fallback generic module (L964)

**Dependencies**:
- Uses `cfg_if!` macro extensively for conditional compilation
- Imports from `crate::prelude::*` (L1)
- References to parent crate types (e.g., `crate::timespec`, `crate::uid_t`)

**Notable Patterns**:
- Heavy use of conditional compilation to handle platform differences
- Unverified struct comments indicate potential ABI compatibility issues
- Alignment attributes on pthread structures for memory layout compatibility
- Link name attributes for ESP-IDF lwIP integration