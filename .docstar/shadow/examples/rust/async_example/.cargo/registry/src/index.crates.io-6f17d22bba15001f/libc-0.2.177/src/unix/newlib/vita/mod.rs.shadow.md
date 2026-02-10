# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/newlib/vita/mod.rs
@source-hash: 20fd016df6c8aa90
@generated: 2026-02-09T17:58:21Z

**PlayStation Vita libc Bindings Module**

Platform-specific C library bindings for PlayStation Vita (PSVita) using newlib. Part of the Rust libc crate providing low-level system interface definitions.

## Core Types

**Basic Type Aliases (L4-8):**
- `clock_t` = `c_long` - time measurement in clock ticks
- `wchar_t` = `u32` - wide character type (32-bit Unicode)  
- `sigset_t` = `c_ulong` - signal set bitmask

## Key Structures

**Network/Socket Structures (L11-58):**
- `msghdr` (L11-19) - message header for sendmsg/recvmsg operations
- `sockaddr` (L21-25) - generic socket address with 14-byte data field
- `sockaddr_in` (L37-44) - IPv4 socket address with PSVita-specific `sin_vport` field
- `sockaddr_in6` (L27-35) - IPv6 socket address with `sin6_vport` extension
- `sockaddr_un` (L46-50) - Unix domain socket with 108-char path
- `sockaddr_storage` (L52-58) - generic storage for any socket address type

**System Structures:**
- `sched_param` (L60-62) - scheduling parameters containing priority
- `stat` (L64-79) - file status information with standard Unix fields
- `dirent` (L82-86) - directory entry with 256-char name and 8-byte alignment

## Constants

**Network Constants (L89-126):**
- Address families: `AF_UNIX=1`, `AF_INET6=24`
- Socket types: `SOCK_RAW=3`, `SOCK_RDM=4`, `SOCK_SEQPACKET=5`
- Poll events: `POLLIN=0x0001`, `POLLOUT=0x0004`, error flags
- Socket options and message flags with PSVita-specific values

**File/System Constants (L127-172):**
- Time handling: `UTIME_OMIT=-1`, `AT_FDCWD=-2`
- File flags: `O_DIRECTORY=0x200000`, `O_NOFOLLOW=0x100000`
- Signal definitions: `SIGHUP=1` through `SIGTERM=15`
- DNS/getaddrinfo error codes: `EAI_BADFLAGS=-1` through `EAI_OVERFLOW=-12`

## External Functions

**I/O Operations (L174-179):**
- `futimens` - set file timestamps
- `writev`/`readv` - vectored I/O operations
- `sendmsg`/`recvmsg` - message-based socket communication

**Threading Functions (L181-231):**
- `pthread_create` - thread creation
- Scheduling parameter functions for thread attributes and active threads
- PSVita-specific processor affinity functions (`*_processorcpu_np`)
- Condition variable clock attribute management
- `getentropy` - secure random number generation

**System Functions:**
- `pipe2` (L234) - create pipe with flags

## Architecture Notes

- Uses PSVita-specific extensions like `sin_vport`/`sin6_vport` in socket addresses
- Includes PSVita processor affinity extensions (`pthread_*processorcpu_np`)
- Directory entries use opaque 88-byte offset field with 8-byte alignment
- Constants values are PSVita-specific, differing from standard Unix values