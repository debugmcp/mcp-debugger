# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/arch/powerpc/mod.rs
@source-hash: 0e20b7e63fe39a20
@generated: 2026-02-09T17:57:05Z

## PowerPC Architecture Constants for Linux libc

This module provides PowerPC-specific socket options, ioctl commands, and resource limit constants for Linux systems. It serves as the PowerPC architecture-specific layer within the libc crate's Unix/Linux hierarchy.

### Primary Components

**Socket Options (L6-129)**: Complete set of socket option constants for PowerPC Linux, with several key architectural differences:
- Standard socket level constant `SOL_SOCKET` (L6)
- PowerPC-specific socket buffer watermark constants `SO_RCVLOWAT` and `SO_SNDLOWAT` (L25-26)
- Time-based socket options with conditional compilation for 64-bit time support (L28-42, L55-73)
- Extended socket control message constants including device memory support (L127-128)

**Ioctl Constants (L132-214)**: Terminal and device I/O control commands with target environment conditionals:
- Terminal control operations (`TCGETS`, `TCSETS`, etc.) differentiated between GNU and musl libc (L132-144)
- Serial port and TTY management ioctls (L146-209)
- Block device ioctls (L210-213)
- Terminal modem control flags (L216-226)
- Terminal speed and flag constants (L228-229)

**Resource Limits (L233-279)**: Process resource limitation constants with environment-specific types:
- Complete `RLIMIT_*` constant set for both GNU and musl environments (L233-278)
- Deprecated limit count constants with stability warnings (L251-255, L273-277)
- Infinite resource limit constant (L280)

### Architecture-Specific Patterns

- **Conditional Compilation**: Extensive use of `cfg_if!` macros for environment (`target_env = "gnu"/"musl"`) and feature (`linux_time_bits64`) detection
- **PowerPC Differences**: Explicitly noted socket constants that differ from other architectures (L24-26)
- **Type Safety**: Uses crate-specific types (`c_int`, `Ioctl`, `__rlimit_resource_t`) rather than raw integers
- **Legacy Support**: Maintains both old and new variants of time-related constants for backward compatibility

### Dependencies

- `crate::prelude::*` and `crate::Ioctl` imports (L1-2)
- References to parent module definitions (comments at L8, L122-123)
- Cross-references to kernel header `arch/powerpc/include/uapi/asm/socket.h` (L4)

### Critical Constraints

- PowerPC-specific socket watermark constants must maintain distinct values from generic Linux
- Time-related constants require proper conditional compilation for 32/64-bit time support
- RLIMIT constants are marked as potentially unstable across OS versions (deprecation warnings)