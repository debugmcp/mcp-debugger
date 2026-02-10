# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/arch/sparc/mod.rs
@source-hash: 96ed29a86c629657
@generated: 2026-02-09T17:58:18Z

## Purpose
Architecture-specific constants and type definitions for SPARC architecture on Linux systems, providing socket options, ioctl constants, resource limits, and terminal I/O structures unique to SPARC.

## Key Structures
- `termios2` (L5-14): Extended terminal control structure with additional speed fields (`c_ispeed`, `c_ospeed`) and larger control character array (19 elements)

## Socket Constants (L17-117)
- `SOL_SOCKET` (L18): SPARC-specific socket level constant (0xffff)
- Socket option constants (L22-109): Comprehensive set of SO_* constants with SPARC-specific values
- SCM_* constants (L113-117): Socket control message types derived from socket options

## Ioctl Constants (L121-194)
- Terminal control ioctls (L121-131): TCGETS, TCSETS variants for terminal configuration
- TTY ioctls (L132-189): TIOC* constants for terminal device control operations
- Block device ioctls (L190-194): BLK* constants for block device operations
- Commented out ioctls (L195-200): Unused/unsupported operations

## Modem Control Constants (L202-212)
- TIOCM_* flags: Modem line status and control bits (LE, DTR, RTS, CTS, etc.)

## Terminal Speed Constants (L214-215)
- `BOTHER` (L214): Custom baud rate flag
- `IBSHIFT` (L215): Input speed shift value

## Resource Limits (L219-246)
- RLIMIT_* constants (L219-234): Standard POSIX resource limit types
- Deprecated constants (L235-239): Legacy RLIM_NLIMITS definitions
- Architecture-conditional RLIM_INFINITY (L241-246): Different values for sparc vs sparc64

## Dependencies
- `crate::prelude::*` and `crate::Ioctl`: Core libc types and ioctl interface
- Uses conditional compilation (`cfg_if!`) for architecture-specific values

## Architectural Notes
- All constants are SPARC-specific, differing from generic Linux values
- Socket constants reference kernel headers (arch/sparc/include/uapi/asm/socket.h)
- Includes both 32-bit (sparc) and 64-bit (sparc64) SPARC variants