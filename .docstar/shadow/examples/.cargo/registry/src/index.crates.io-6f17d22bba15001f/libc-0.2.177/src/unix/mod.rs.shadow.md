# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/mod.rs
@source-hash: 4f6c804705ede5fa
@generated: 2026-02-09T18:06:34Z

**Purpose**: Common Unix definitions module for the libc crate, providing POSIX-compliant types, structures, constants, and function declarations across all Unix-like systems.

**Core Architecture**:
- Platform-agnostic Unix definitions that apply to most Unix derivatives
- Conditional compilation based on target OS, environment, and features
- Hierarchical organization with OS-specific modules included at bottom (L1849-1901)

**Key Type Definitions**:
- **Integer types** (L8-22): Standard POSIX integer types (`intmax_t`, `size_t`, `pid_t`, etc.)
- **Platform-specific uid/gid** (L23-38): Conditionally sized based on target OS
- **Network types** (L17-19): `in_addr_t`, `in_port_t` for networking
- **Signal handler type** (L20): `sighandler_t` for signal handling

**Critical Structures** (L46-218):
- **group** (L47-52): Unix group information structure
- **timeval** (L59-67): Time representation with microsecond precision, platform-dependent field types
- **timespec** (L72-78): Time with nanosecond precision, x86_64 x32 compatibility handling
- **rlimit** (L80-83): Resource limit structure
- **rusage** (L85-133): Resource usage statistics with extensive x86_64 x32 padding
- **Network structures**: `ipv6_mreq` (L135-141), `hostent` (L144-150), `in6_addr` (L214-217)
- **I/O structures**: `iovec` (L152-155), `pollfd` (L157-161), `winsize` (L163-168)
- **IPC structures**: `sigval` (L176-179), `servent` (L195-203), `protoent` (L205-212)

**Constants**:
- **Integer limits** (L220-221): `INT_MIN`/`INT_MAX`
- **Signal handlers** (L223-225): `SIG_DFL`, `SIG_IGN`, `SIG_ERR`
- **Directory types** (L227-238): `DT_*` constants for file types
- **Syslog facilities/priorities** (L269-307): Complete syslog constant set
- **Network protocols** (L314-324): `IPPROTO_*` constants
- **Network addresses** (L321-332): IPv4/IPv6 standard addresses
- **Pattern matching** (L342-388): `FNM_*` flags with platform-specific variations

**External Variables** (L390-393):
- `in6addr_loopback`/`in6addr_any`: IPv6 address constants

**Linking Configuration** (L395-566):
- Complex conditional linking for different Unix platforms
- Static/dynamic library selection based on `crt-static` feature
- Special handling for musl, Android, BSD variants, and embedded targets

**Missing Types** (L568-580):
- Opaque types: `fpos_t` (platform-dependent), `FILE`, `DIR` (L40-43)

**Function Declarations**:
- **Character classification** (L582-596): `isalnum`, `isdigit`, etc.
- **Standard library** (L597-731): `qsort`, `malloc`, `printf` family, string functions
- **POSIX system calls** (L733-1612): Comprehensive Unix API including file I/O, process control, networking, threading
- **Platform-specific functions** (L1631-1847): Conditionally available based on target OS

**Network Functions** (L1614-1629):
- **Byte order conversion**: `htonl`, `htons`, `ntohl`, `ntohs` - implemented as const functions using Rust's byte order methods

**Conditional Function Groups**:
- **Time adjustment**: `adjtime` (L1631-1650) - different signatures for Solaris
- **String functions**: `stpncpy` (L1652-1662) - not on embedded targets
- **Signal queuing**: `sigqueue` (L1664-1676) - not on all BSDs
- **Terminal I/O**: `cfmakeraw`/`cfsetspeed` (L1827-1843) - different return types on AIX

**Module System** (L1849-1901):
- Includes OS-specific modules: `linux_like`, `bsd`, `solarish`, `haiku`, `redox`, `cygwin`, `nto`, `aix`, `hurd`, `nuttx`
- Uses `cfg_if!` for compile-time platform selection

**Dependencies**:
- Uses `crate::prelude::*` (L6) for common type imports
- Relies on `cfg_if!` macro for conditional compilation
- Uses `s!{}`, `missing!{}`, and `safe_f!{}` macros from parent crate