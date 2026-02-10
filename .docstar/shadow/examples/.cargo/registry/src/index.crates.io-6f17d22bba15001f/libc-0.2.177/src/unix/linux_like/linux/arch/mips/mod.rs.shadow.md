# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/arch/mips/mod.rs
@source-hash: 058ebf07f8b10358
@generated: 2026-02-09T17:58:17Z

**Purpose**: MIPS architecture-specific constants and structures for Linux libc bindings

**Core Components**:

- **termios2 struct (L5-14)**: Extended terminal I/O structure with custom baud rate support
  - Contains standard termios fields plus separate input/output speed fields
  - Uses 23-byte control character array (larger than standard termios)

**Socket Constants (L18-141)**:
- **SOL_SOCKET (L18)**: MIPS-specific socket level constant (0xffff vs standard 1)
- **SO_* constants (L22-132)**: Socket option constants with MIPS-specific values
- **Time-sensitive constants (L36-50, L100-118)**: Conditional definitions based on `linux_time_bits64` feature
  - SO_SNDTIMEO/SO_RCVTIMEO use different values for 64-bit time vs legacy
  - SO_TIMESTAMP variants similarly conditional

**Ioctl Constants (L144-229)**:
- **Terminal control (L144-154)**: TCGETS, TCSETS family with MIPS-specific values
- **TTY control (L155-197)**: TIOC* constants for terminal device control
- **File control (L200-202)**: FION* constants for file I/O control
- **Serial control (L203-213)**: TIOSER* constants for serial port management
- **Block device (L219-222)**: BLK* constants for block device operations
- **RS485 support (L224-229)**: Conditional RS485 constants for musl environment

**Terminal modem control (L231-241)**: TIOCM_* bit flags for modem line status

**Speed/flag constants (L243-244)**: BOTHER for custom baud rates, IBSHIFT for input flag positioning

**RLIMIT Constants (L248-333)**:
- **Resource limits (L250-293)**: Conditional definitions based on target environment (gnu/uclibc vs musl)
- **RLIM_INFINITY (L305-333)**: Complex conditional logic for infinity value based on architecture and environment
  - 64-bit MIPS: always ~0
  - 32-bit MIPS: depends on time_bits64 and file_offset_bits64 features

**Key Dependencies**:
- Uses `crate::prelude::*` and `crate::Ioctl` type
- Heavily relies on `cfg_if!` macro for conditional compilation
- References various crate types: `tcflag_t`, `cc_t`, `speed_t`, `rlim_t`, `__rlimit_resource_t`

**Architecture Notes**:
- MIPS has unique socket constant values compared to other architectures
- Extensive use of feature flags for time64 and large file support
- Different constant values between 32-bit and 64-bit MIPS variants