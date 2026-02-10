# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/mod.rs
@source-hash: e05f88aabb6ca6c3
@generated: 2026-02-09T18:02:39Z

## Purpose
BSD Unix module providing core system type definitions, constants, and function bindings shared across BSD-based operating systems (FreeBSD, OpenBSD, NetBSD, macOS/iOS/tvOS/watchOS/visionOS, DragonflyBSD). Part of the libc crate's cross-platform C library bindings.

## Key Type Definitions (L3-10)
- `off_t`, `blkcnt_t` (i64): File offset and block count types
- `useconds_t` (u32): Microsecond time type  
- `socklen_t` (u32), `sa_family_t` (u8): Socket address length and family types
- `pthread_t` (uintptr_t): Thread identifier type
- `nfds_t` (c_uint): Number of file descriptors type
- `regoff_t` (off_t): Regular expression offset type

## Core Data Structures

### Network Structures (L13-17, L19-26)
- `sockaddr` (L13-17): Generic socket address with BSD-specific `sa_len` field
- `sockaddr_in6` (L19-26): IPv6 socket address structure
- `sockaddr_un` (L137-141): Unix domain socket address with platform-specific path length

### System Info Structures  
- `passwd` (L28-50): User password database entry with conditional `pw_fields` (not on macOS/iOS/NetBSD/OpenBSD)
- `utsname` (L143-164): System information with DragonFly-specific smaller field sizes (32 vs 256 chars)
- `ifaddrs` (L52-62): Network interface address list with NetBSD-specific `ifa_addrflags`

### I/O and IPC Structures
- `fd_set` (L64-75): File descriptor set with architecture-specific bit arrays (i64 for 64-bit FreeBSD/DragonFly, i32 otherwise)
- `msghdr` (L91-99), `cmsghdr` (L101-105): Socket message headers for control message passing
- `tm` (L77-89): Time structure with BSD extensions (gmtoff, zone)

### Other Structures
- `if_nameindex` (L111-114): Network interface name/index mapping
- `regex_t` (L116-121), `regmatch_t` (L123-126): Regular expression compilation and matching
- `option` (L128-133): Command-line option parsing (getopt_long)

## Platform-Specific Traits (L167-231)
Conditional implementations of `PartialEq`, `Eq`, and `Hash` for `sockaddr_un` and `utsname` when `extra_traits` feature enabled. Uses element-wise comparison for array fields.

## Extensive Constants
- Locale categories (L234-240): LC_ALL through LC_MESSAGES
- File I/O control commands (L242-248): FIOCLEX, FIONREAD, FIONBIO, etc.
- Signal handling (L255-287): SA_* flags, SS_* stack flags, SIG_* mask operations
- Signal numbers (L266-283): BSD-specific signal assignments
- Network options (L289-305): IP and IPv6 socket options, ECN flags
- File operations (L313-328): O_* open flags with BSD extensions (O_SHLOCK, O_EXLOCK)
- Terminal I/O (L351-426): Comprehensive termios constants
- Process control (L428-429): WNOHANG, WUNTRACED wait options
- Dynamic linking (L431-435): RTLD_* flags with special pointer values
- Routing (L533-572): RTF_*, RTM_*, RTA_*, RTAX_* network routing constants
- Regular expressions (L485-518): REG_* compilation, execution, and error flags

## BSD-Specific Function Implementations (L574-607)
- `CMSG_FIRSTHDR` (L575-581): Control message header access
- `FD_CLR`, `FD_ISSET`, `FD_SET`, `FD_ZERO` (L583-607): File descriptor set manipulation with bit-level operations

## Process Status Functions (L610-630)  
Safe const functions for parsing wait status: `WTERMSIG`, `WIFEXITED`, `WEXITSTATUS`, `WCOREDUMP`, `QCMD`

## External C Function Bindings (L632-948)
Extensive extern "C" block with platform-specific symbol versioning:
- Resource management: `getrlimit`, `setrlimit` with macOS x86 UNIX2003 versions
- Network interface: `getifaddrs`, `freeifaddrs`, `if_nameindex`
- User/group management: `getpwent`, `getpwnam_r`, `getpwuid_r` with NetBSD symbol versions
- Threading: `pthread_create`, `pthread_cancel`, `pthread_sigmask` with conditional linking
- Socket I/O: `bind`, `sendmsg`, `recvmsg`, `writev`, `readv` with UNIX2003 versions
- File globbing: `glob`, `globfree` with NetBSD and FreeBSD version-specific symbols
- Random number generation: `arc4random` family, `drand48` family
- Regular expressions: `regcomp`, `regexec`, `regerror`, `regfree`

## Platform Module Selection (L950-968)
Conditional compilation directing to platform-specific submodules:
- Apple platforms → `apple` module
- NetBSD/OpenBSD → `netbsdlike` module  
- FreeBSD/DragonFly → `freebsdlike` module

## Dependencies
- `crate::prelude::*`: Core libc types and macros
- `cfg_if`: Conditional compilation utility
- Platform-specific submodules for OS-specific extensions