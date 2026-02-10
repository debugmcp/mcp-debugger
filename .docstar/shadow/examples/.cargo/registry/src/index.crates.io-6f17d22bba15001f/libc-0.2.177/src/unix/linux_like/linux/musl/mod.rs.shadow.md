# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/mod.rs
@source-hash: d8afb6167cab328d
@generated: 2026-02-09T18:02:36Z

**Purpose**: Musl-specific Linux type definitions and function bindings for the `libc` crate. Provides platform-specific implementations of system types, structures, and constants for musl-based Linux systems.

**Key Type Aliases (L1-29)**:
- Standard POSIX types: `pthread_t`, `clock_t`, `suseconds_t`, `ino_t`, `off_t`, `blkcnt_t`
- **Deprecated `time_t` (L6-15)**: Currently `c_long` but will change to 64-bit in future musl 1.2.0+ compatibility
- IPC types: `shmatt_t`, `msgqnum_t`, `msglen_t`
- Filesystem types: `fsblkcnt_t`, `fsfilcnt_t`, `rlim_t`
- **Conditional `Ioctl` type (L30-38)**: Different visibility based on doc feature

**Signal Information Handling**:
- `siginfo_t` implementation with unsafe accessors (L40-122)
- `si_addr()` and `si_value()` methods (L41-63) using cast-based field access
- Internal union structures for signal field access (L67-96)
- Child process signal accessors: `si_pid()`, `si_uid()`, `si_status()`, `si_utime()`, `si_stime()` (L103-121)

**Key Structures (L124-425)**:
- `aiocb`: Asynchronous I/O control block (L125-140)
- `fanotify_event_metadata`: File system event monitoring (L142-151) 
- `sigaction`: Signal handler configuration (L155-160)
- `siginfo_t`: Signal information with architecture-specific field ordering for MIPS (L166-181)
- `statvfs`/`statvfs64`: File system statistics with endianness-specific layouts (L183-221)
- `termios`: Terminal I/O settings (PowerPC excluded, L224-234)
- `flock`/`flock64`: File locking structures (L236-250)
- `tcp_info`: Comprehensive TCP connection statistics (L331-390)
- `statfs`/`statfs64`: File system information (MIPS/s390x excluded, L393-424)

**Special Structures**:
- `sysinfo` and `utmpx` in `s_no_extra_traits!` macro (L427-478) with conditional trait implementations
- Complex version handling for `utmpx.ut_session` field based on musl version (L455-472)

**Constants**:
- Memory mapping huge page encodings (L580-594)
- UTMP/UTMPX entry types (L599-608) 
- File descriptor and error code constants (L610-636)
- POSIX advisory constants with s390x-specific variants (L840-848)
- Network protocol family constants (L724-733)
- Time adjustment and status constants (L773-820)

**External Function Bindings (L850-974)**:
- Socket operations: `sendmmsg()`, `recvmmsg()` (L851-863)
- Process control: `ptrace()`, priority functions (L874-876)
- File system: `fanotify_mark()` with musl-specific `c_ulonglong` mask type (L880-886)
- Memory operations: `explicit_bzero()`, `reallocarray()`, `malloc_usable_size()` (L904-915)
- **Deprecated UTMP functions (L939-973)**: All marked deprecated with musl-specific warnings about stub implementations

**Architecture Dependencies**:
- Different `NCCS` values for PowerPC vs other architectures (L612-615)
- Different `CPU_SETSIZE` for LoongArch64 vs others (L687-690)
- Conditional struct definitions excluding specific architectures (PowerPC, MIPS, s390x)
- Architecture-specific module inclusion via `cfg_if!` blocks (L980-1005)

**Module Structure**:
- Imports LFS64 aliases (L977-978)
- Conditionally imports `b64` or `b32` modules based on target architecture (L980-1005)
- Uses `prelude` and imports `off64_t` from crate root