# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/arch/generic/mod.rs
@source-hash: c8f4d88ba7ffe044
@generated: 2026-02-09T17:57:01Z

## Linux Generic Architecture Constants and Types

**Primary Purpose:** Generic Linux architecture definitions providing platform-neutral system constants for socket options, ioctl operations, terminal control, and resource limits. Part of the libc crate's Unix/Linux platform abstraction layer.

**Key Structure:**
- `termios2` struct (L5-14): Extended terminal I/O structure with separate input/output speeds, containing control flags, line discipline, and character arrays

**Major Constant Categories:**

**Socket Options (L21-169):**
- Basic socket constants: `SOL_SOCKET`, `SO_REUSEADDR`, `SO_TYPE`, etc. (L21-51)
- Time-sensitive constants with conditional compilation based on `linux_time_bits64` feature and architecture (L52-86, L122-148)
- Advanced socket features: BPF attachment, memory management, device memory (L88-169)
- SCM (Socket Control Message) aliases for timestamp and device memory operations

**Ioctl Constants (L172-259):**
- Terminal control operations: `TCGETS`, `TCSETS`, `TCSETSW`, `TCSETSF` (L172-175)
- TTY operations: `TIOCEXCL`, `TIOCGPGRP`, `TIOCSWINSZ` (L183-191)
- Block device operations: `BLKIOMIN`, `BLKSSZGET` (L248-251)
- Architecture-specific `FIOQSIZE` values for ARM/s390x vs other architectures (L253-259)

**Terminal Modem Control (L261-271):**
- Modem line status bits: `TIOCM_LE`, `TIOCM_DTR`, `TIOCM_RTS`, etc.
- Aliased constants: `TIOCM_CD` = `TIOCM_CAR`, `TIOCM_RI` = `TIOCM_RNG`

**Resource Limits (L276-334):**
- Environment-specific RLIMIT constants with different types:
  - GNU/uClibc: uses `crate::__rlimit_resource_t` (L278-298)  
  - musl/OHOS: uses `c_int` (L299-322)
- Standard limits: CPU, memory, file descriptors, stack size
- Deprecated `RLIMIT_NLIMITS`/`RLIM_NLIMITS` with version-specific warnings

**Architecture Decisions:**
- Heavy use of `cfg_if!` macros for conditional compilation across environments and architectures
- Time-related socket options handle 64-bit time transition complexity
- Maintains compatibility across GNU libc, musl, uClibc, and OHOS environments
- Uses type aliases from parent crate modules for consistency

**Dependencies:**
- `crate::prelude::*` and `crate::Ioctl` imports
- References to parent module types: `tcflag_t`, `speed_t`, `cc_t`, `__rlimit_resource_t`