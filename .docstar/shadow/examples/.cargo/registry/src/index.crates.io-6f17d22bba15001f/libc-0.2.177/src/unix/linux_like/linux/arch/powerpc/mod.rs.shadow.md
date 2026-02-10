# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/arch/powerpc/mod.rs
@source-hash: 0e20b7e63fe39a20
@generated: 2026-02-09T17:58:17Z

## PowerPC Linux Constants Module

This module defines PowerPC-specific Linux system constants for socket operations, ioctl commands, and resource limits. Part of the libc crate's Unix/Linux architecture-specific layer.

**Primary Purpose:** Provides PowerPC-specific constant definitions that override or supplement generic Linux constants, handling architectural differences in system call interfaces.

### Key Sections:

**Socket Constants (L6-129):**
- Socket level and option constants following PowerPC's socket.h definitions
- Notable PowerPC-specific differences: `SO_RCVLOWAT` (L25) and `SO_SNDLOWAT` (L26) with values 16/17
- Conditional compilation based on `linux_time_bits64` feature for timestamp constants (L28-42, L55-73)
- Complete SO_* socket option constants from basic options (L10-27) to modern features like device memory (L118-120)
- SCM (Socket Control Message) aliases for timestamp and device memory constants (L124-128)

**Ioctl Constants (L130-227):**
- Terminal control ioctl commands with conditional values for GNU vs musl environments (L132-144)
- TCGETS/TCSETS family differs between GNU (0x403c7413/0x803c7414) and musl (0x402c7413/0x802c7414)
- Comprehensive terminal ioctl definitions including TIOC* commands for terminal I/O control (L146-214)
- Block device ioctl constants (L210-214)
- TIOCM_* modem control bit flags (L216-226)

**Terminal Configuration (L228-230):**
- `BOTHER` speed constant and `IBSHIFT` flag for terminal configuration

**Resource Limits (L231-280):**
- RLIMIT_* constants with different types based on target environment
- GNU environment uses `crate::__rlimit_resource_t` (L235-255)
- musl environment uses `c_int` (L257-277)  
- Deprecated RLIM_NLIMITS/RLIMIT_NLIMITS constants (L251-255, L273-277)
- `RLIM_INFINITY` set to maximum value (!0) (L280)

### Architecture-Specific Behavior:
- PowerPC socket constants differ from other architectures in low water mark values
- Ioctl command values are PowerPC-specific encodings
- Conditional compilation ensures correct constants for different C library environments
- Time-related socket options handle both legacy and 64-bit time variants

### Dependencies:
- Uses `crate::prelude::*` and `crate::Ioctl` imports (L1-2)
- References various libc types: `c_int`, `speed_t`, `tcflag_t`, `rlim_t`, `__rlimit_resource_t`