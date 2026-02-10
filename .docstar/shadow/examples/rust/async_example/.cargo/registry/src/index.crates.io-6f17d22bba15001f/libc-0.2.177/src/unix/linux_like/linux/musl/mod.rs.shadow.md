# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/mod.rs
@source-hash: d8afb6167cab328d
@generated: 2026-02-09T17:57:36Z

## File Purpose
Defines musl-specific type aliases, structures, and bindings for Linux systems. This module bridges Rust FFI with musl libc implementation, providing platform-specific definitions that differ from glibc.

## Key Type Definitions (L1-29)
- Basic system types: `pthread_t`, `clock_t`, `time_t` (deprecated), `suseconds_t`
- File system types: `ino_t`, `off_t`, `blkcnt_t`
- IPC types: `shmatt_t`, `msgqnum_t`, `msglen_t`
- File system count types: `fsblkcnt_t`, `fsblkcnt64_t`, `fsfilcnt_t`, `fsfilcnt64_t`
- Resource limit type: `rlim_t`

## Signal Info Implementation (L40-122)
`siginfo_t` implementation with unsafe field accessors:
- `si_addr()` (L41-50): Returns signal fault address
- `si_value()` (L52-63): Returns signal value
- `sifields()` (L99-101): Internal union field accessor
- Child signal accessors (L103-121): `si_pid()`, `si_uid()`, `si_status()`, `si_utime()`, `si_stime()`

## Core Structures (L124-424)
- `aiocb` (L125-140): Asynchronous I/O control block
- `fanotify_event_metadata` (L143-151): File access notification metadata
- `sigaction` (L155-160): Signal action configuration
- `siginfo_t` (L166-181): Signal information with MIPS-specific field ordering
- `statvfs`/`statvfs64` (L183-221): File system statistics
- `termios` (L225-234): Terminal I/O settings (architecture-conditional)
- `flock`/`flock64` (L236-250): File locking structures
- Network and system structures (L252-424): `rtentry`, `timex`, `tcp_info`, `statfs`/`statfs64`

## Special Structures (L427-478)
`s_no_extra_traits!` macro defines:
- `sysinfo` (L428-443): System information
- `utmpx` (L445-477): User accounting with version-dependent `ut_session` field

## Trait Implementations (L480-570)
Conditional `extra_traits` feature implementations for `sysinfo` and `utmpx`:
- `PartialEq`, `Eq`, and `Hash` traits
- Complex field-by-field comparison logic

## Constants
- Memory mapping huge pages (L580-595): `MAP_HUGE_*` constants
- UTMP record types (L599-609): `EMPTY`, `RUN_LVL`, `BOOT_TIME`, etc.
- File descriptor flags and error codes (L610-847)
- Process tracing constants (L692-722): `PTRACE_*` operations
- Time adjustment constants (L773-829): `ADJ_*` and `MOD_*` flags

## External Functions (L850-974)
Critical system call bindings:
- Network: `sendmmsg()`, `recvmmsg()` (L851-863)
- Process management: `ptrace()`, `getpriority()`, `setpriority()` (L874-876)
- File operations: `preadv2()`, `pwritev2()` (L887-900)
- Memory: `memfd_create()`, `mlock2()` (L913-914)
- Time: `adjtimex()`, `clock_adjtime()` (L908-909)
- UTMP functions (L943-973): All deprecated due to musl stub implementation

## Architecture Dependencies
- Conditional compilation based on target architecture
- MIPS-specific field ordering in `siginfo_t`
- PowerPC-specific exclusions for certain structures
- 32/64-bit architecture variations

## Module Structure
- Imports LFS64 aliases (L977-978)
- Conditionally includes b32/b64 architecture-specific modules (L980-1006)