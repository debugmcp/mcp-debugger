# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/hermit.rs
@source-hash: f150c2882a4d8e51
@generated: 2026-02-09T18:11:37Z

**Purpose**: Hermit OS C type definitions and system call bindings for the libc crate. Hermit is a unikernel operating system, and this module provides the platform-specific FFI layer that bridges Rust's libc interface to Hermit's syscall ABI.

**Key Type Definitions (L5-23)**:
- Standard C integer types (`intmax_t`, `uintmax_t`, `intptr_t`, `uintptr_t`)
- System-specific types for networking (`in_addr_t`, `in_port_t`, `socklen_t`)
- Process and file system types (`pid_t`, `mode_t`, `time_t`, `clockid_t`)

**Core Data Structures (L24-115)**:
- **Network structs**: `addrinfo` (L25-34), `sockaddr*` variants (L64-93), `in_addr`/`in6_addr` (L49-47)
- **File system**: `dirent64` (L36-42), `stat` (L95-109) with standard Unix stat fields
- **I/O**: `iovec` (L53-56) for vectored I/O, `pollfd` (L58-62) for polling
- **Time**: `timespec` (L111-114) for nanosecond precision timing

**Constants (L117-385)**:
- **Network families**: `AF_INET`=3, `AF_INET6`=1 (non-standard values for Hermit)
- **Socket options**: Standard `SO_*`, `SOCK_*`, `IPPROTO_*` definitions
- **File operations**: `O_*` flags, `S_*` permission bits following Unix conventions
- **Error codes**: Complete errno set (L253-385) matching Linux values
- **Poll events**: `POLLIN`, `POLLOUT`, etc. with standard bit patterns

**System Call Interface (L387-561)**:
All functions use `#[link_name = "sys_*"]` attributes to map to Hermit syscalls:
- **Memory**: `alloc`, `realloc`, `dealloc` (L388-398)
- **Process**: `exit`, `abort`, `errno` (L400-407) 
- **Time**: `clock_gettime`, `nanosleep` (L409-413)
- **Threading**: `futex_wait`, `futex_wake` (L418-427)
- **File I/O**: `open`, `read`, `write`, `close`, `stat` family (L429-472)
- **Networking**: Complete socket API from `socket` to `shutdown` (L485-554)
- **Events**: `eventfd`, `poll` (L556-560)

**Architecture Notes**:
- Uses `s!` macro for struct definitions (likely from parent crate)
- Hermit-specific syscall naming convention with "sys_" prefix
- Some non-standard constant values (e.g., AF_INET6=1 instead of typical 10)
- Memory allocation functions are direct syscalls rather than libc wrappers
- Complete POSIX-like interface despite being a unikernel

**Dependencies**: Imports from `crate::prelude::*` for basic C types (`c_char`, `c_void`, `c_int`).