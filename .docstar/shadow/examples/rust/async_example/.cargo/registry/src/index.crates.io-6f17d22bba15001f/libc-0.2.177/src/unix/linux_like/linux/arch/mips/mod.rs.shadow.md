# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/arch/mips/mod.rs
@source-hash: 058ebf07f8b10358
@generated: 2026-02-09T17:57:07Z

**Purpose**: MIPS architecture-specific constants and structures for Linux system programming, primarily focused on socket options, terminal I/O control, and resource limits.

## Key Structures

- **`termios2`** (L5-14): Enhanced terminal control structure with separate input/output speeds, extending beyond standard POSIX termios. Contains control flags (c_iflag, c_oflag, c_cflag, c_lflag), line discipline (c_line), control characters array [23], and independent baud rates (c_ispeed, c_ospeed).

## Socket Options (L17-141)
Comprehensive SO_* constants for socket configuration:
- **Core socket options** (L18-54): SOL_SOCKET, SO_REUSEADDR, SO_KEEPALIVE, SO_BROADCAST, etc.
- **Time-sensitive options** (L36-50, L100-118): Conditional compilation based on `linux_time_bits64` feature, providing old/new variants for SO_RCVTIMEO, SO_SNDTIMEO, SO_TIMESTAMP*, supporting both 32-bit and 64-bit time representations
- **Advanced features** (L55-99): BPF attachment, security, memory management, device binding
- **Recent additions** (L121-133): Performance optimizations, memory management, pidfd support

## Terminal I/O Control Constants (L142-229)
Extensive ioctl command definitions:
- **Basic terminal control** (L144-154): TCGETS/TCSETS family for terminal attribute manipulation
- **Advanced terminal operations** (L155-198): TIOC* commands for window sizing, modem control, pseudo-terminals
- **Serial port operations** (L203-214): Hardware-specific serial configuration
- **Block device operations** (L219-223): Storage device parameter queries
- **Conditional RS485 support** (L224-229): musl-specific serial communication extensions

## Hardware Control Flags (L231-245)
Modem control line constants (TIOCM_*) and terminal speed/flag definitions including BOTHER for custom baud rates and IBSHIFT for input flag positioning.

## Resource Limits (L246-333)
Multi-conditional RLIMIT_* constants with complex target environment logic:
- **GNU/uClibc variants** (L248-268): Uses `__rlimit_resource_t` type
- **musl variants** (L269-293): Uses `c_int` type with explicit RLIM_INFINITY
- **Architecture-specific RLIM_INFINITY** (L305-333): Complex conditional logic for 32-bit vs 64-bit MIPS variants, time representation, and file offset modes

## Architectural Patterns
- Heavy use of `cfg_if!` macros for conditional compilation across target environments (musl, GNU, uClibc) and architecture variants
- Time representation abstraction supporting both legacy 32-bit and modern 64-bit time handling
- Consistent hexadecimal constant formatting for system call numbers and flags
- Deprecated constant handling with migration guidance