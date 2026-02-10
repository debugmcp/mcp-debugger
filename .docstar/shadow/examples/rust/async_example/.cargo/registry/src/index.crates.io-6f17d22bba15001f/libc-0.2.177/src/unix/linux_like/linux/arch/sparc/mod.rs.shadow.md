# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/arch/sparc/mod.rs
@source-hash: 96ed29a86c629657
@generated: 2026-02-09T17:57:04Z

## Purpose
SPARC-specific Linux constants and structures for the libc crate. Provides platform-specific socket options, ioctl commands, terminal I/O structures, and resource limits for SPARC architecture on Linux.

## Key Components

### Terminal I/O Structure
- `termios2` struct (L5-14): Extended terminal interface structure with additional speed fields, containing control flags (`c_iflag`, `c_oflag`, `c_cflag`, `c_lflag`), line discipline (`c_line`), control characters array, and input/output speeds

### Socket Option Constants
- Socket level: `SOL_SOCKET` (L18): Set to SPARC-specific value `0xffff`
- Socket options (L22-109): Comprehensive set of SO_* constants for socket behavior control including `SO_REUSEADDR`, `SO_KEEPALIVE`, `SO_BROADCAST`, buffer management, timestamping, and device memory options
- Socket control messages (L113-117): SCM_* constants derived from corresponding SO_* values

### Ioctl Commands
- Terminal control (L121-174): TCGETS/TCSETS family for terminal attribute management, TIOC* commands for terminal I/O control including window size, process groups, and serial line control
- Block device operations (L190-193): BLKIOMIN, BLKIOOPT, BLKSSZGET, BLKPBSZGET for block device parameter queries
- Modem control bits (L202-212): TIOCM_* constants for controlling modem signal lines

### Terminal Configuration
- Speed and flag constants (L214-215): `BOTHER` for non-standard baud rates, `IBSHIFT` for input flag bit shifting

### Resource Limits
- RLIMIT constants (L219-239): Standard Unix resource limit identifiers including CPU time, file size, memory limits, and process limits
- Architecture-specific infinity value (L241-246): Uses `cfg_if!` to set `RLIM_INFINITY` based on SPARC32 vs SPARC64 architecture

## Dependencies
- Uses `crate::prelude::*` for common type definitions
- Imports `crate::Ioctl` type for ioctl command constants
- References various crate-level types like `tcflag_t`, `speed_t`, `cc_t`

## Architectural Notes
- SPARC has unique socket constant values compared to other architectures
- Distinguishes between 32-bit and 64-bit SPARC for resource limit infinity values
- Contains many commented-out constants suggesting evolution of the kernel interface