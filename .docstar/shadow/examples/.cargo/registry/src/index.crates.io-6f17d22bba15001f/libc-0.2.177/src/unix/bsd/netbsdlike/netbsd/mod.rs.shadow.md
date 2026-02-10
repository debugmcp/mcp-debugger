# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/netbsd/mod.rs
@source-hash: 461feb5dc8dddea3
@generated: 2026-02-09T18:02:35Z

## NetBSD-specific libc bindings for Rust

Primary purpose: Platform-specific type definitions, constants, and function bindings for NetBSD operating system. This file provides the NetBSD layer in the Unix BSD hierarchy of the libc crate.

### Type Definitions

**Core System Types (L4-20)**
- Basic system types: `clock_t`, `suseconds_t`, `dev_t`, `blksize_t`, etc.
- Threading types: `pthread_spin_t`, `lwpid_t` 
- Memory types: `vm_size_t`, `shmatt_t`
- CPU types: `cpuid_t`, `cpuset_t`

**ELF Types (L23-37)**
- 32-bit ELF types: `Elf32_Addr`, `Elf32_Half`, `Elf32_Word`, etc.
- 64-bit ELF types: `Elf64_Addr`, `Elf64_Half`, `Elf64_Word`, etc.
- Conditional type aliasing based on pointer width (L50-60)

### Key Enums and Structs

**File Action Enum (L41-48)**
- `fae_action`: Defines spawn file actions (OPEN, DUP2, CLOSE)

**Core System Structures (L132-793)**
- `aiocb` (L133-144): Async I/O control block
- `stat` (L178-200): File status structure with NetBSD-specific fields
- `pthread_*` structures (L222-293): Threading primitives with NetBSD layout
- `kevent` (L295-303): Kernel event notification structure
- Process info structures: `kinfo_proc2` (L535-630), `kinfo_lwp` (L632-657)

**Network Structures (L202-220, L382-415)**
- `addrinfo`: Address info for getaddrinfo()
- `sockaddr_dl`: Data link socket address
- Network credential structures: `sockcred`, `uucred`, `unpcbid`

### Signal Handling

**siginfo_t Implementation (L62-130)**
- Unsafe accessor methods for signal information
- Platform-specific field access through type casting
- Methods: `si_addr()`, `si_code()`, `si_errno()`, `si_pid()`, `si_uid()`, `si_value()`, `si_status()`

### Platform Constants

**File/Directory Operations (L1235-1294)**
- `AT_*` constants for *at() system calls
- `O_*` flags: `O_CLOEXEC`, `O_DIRECTORY`, `O_DIRECT`, etc.
- Extended attribute namespaces

**Network Protocol Constants (L1415-1483)**
- Comprehensive IP protocol definitions
- Address families: `AF_BLUETOOTH`, `AF_IEEE80211`, `AF_MPLS`
- Socket options and flags

**System Limits and Capabilities (L1600-1687)**
- POSIX configuration constants (`_PC_*`, `_SC_*`)
- System resource limits
- Threading and synchronization limits

### Memory Management

**Memory Mapping Flags (L1523-1539)**
- NetBSD-specific mmap() flags: `MAP_WIRED`, `MAP_STACK`, `MAP_TRYFIXED`
- Memory alignment macros and constants
- `MAP_ALIGNED()` function for alignment specification (L2269-2271)

### Threading Support

**pthread Constants (L1809-1855)**
- Mutex initializers with architecture-specific layouts
- Condition variable and rwlock initializers
- Mutex types: NORMAL, ERRORCHECK, RECURSIVE

### Event Notification

**kqueue/kevent System (L1862-1913)**
- Event filters: `EVFILT_READ`, `EVFILT_WRITE`, `EVFILT_SIGNAL`, etc.
- Event flags: `EV_ADD`, `EV_DELETE`, `EV_ENABLE`, etc.
- Note flags for different event types

### System Information

**sysctl Interface (L1938-2089)**
- Comprehensive sysctl constants (`CTL_*`, `KERN_*`)
- System information categories: kernel, VM, network, hardware
- Process and system state queries

### External Function Bindings

**Core System Functions (L2396-2772)**
- Time functions: `ntp_adjtime()`, `clock_nanosleep()`
- Process control: `ptrace()`, threading functions
- Memory: `mprotect()`, `mremap()`, `reallocarr()`
- File system: `chflags()`, extended attributes

**Specialized Libraries**
- librt (L2774-2794): Async I/O functions
- libutil (L2796-2959): Utility functions, login/logout, extended attributes
- libexecinfo (L2961-2977): Stack backtrace functions

### Architecture Support

**Platform-Specific Code (L2979-3007)**
- Conditional compilation for multiple architectures
- Supported: aarch64, arm, powerpc, sparc64, x86_64, x86, mips, riscv64
- Architecture-specific implementations imported via modules

### Notable Patterns

1. **Version-Tagged Functions**: Many functions use `#[link_name]` with version suffixes (e.g., `__gettimeofday50`)
2. **Unsafe Signal Access**: Signal info requires unsafe casting due to union-like C structures
3. **Architecture Awareness**: Conditional compilation and structure layouts vary by CPU architecture
4. **BSD Compatibility**: Maintains compatibility with other BSD variants while providing NetBSD-specific extensions

### Critical Dependencies

- Parent modules: `crate::prelude::*`, `crate::{cmsghdr, off_t}`
- Platform detection via `cfg_if!` macro
- Size and alignment calculations using `core` functions