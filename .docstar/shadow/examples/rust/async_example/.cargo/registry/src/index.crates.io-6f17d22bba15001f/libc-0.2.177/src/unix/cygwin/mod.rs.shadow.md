# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/cygwin/mod.rs
@source-hash: c98bb7c1118c249f
@generated: 2026-02-09T18:02:51Z

## Cygwin Platform Type Definitions and System Interface

This file defines Cygwin-specific type aliases, structures, constants, and function declarations for the `libc` crate, serving as the primary platform interface for Unix-like operations on Windows through Cygwin.

### Core Type Definitions

**Primitive Type Aliases (L4-29)**: Maps C types to Rust equivalents for Cygwin platform:
- `wchar_t = c_ushort` - Wide character type (L4)  
- File system types: `blkcnt_t`, `blksize_t`, `dev_t`, `ino_t` (L6-11)
- Time types: `clock_t`, `time_t`, `clockid_t`, `timer_t` (L22-25)
- Threading types: `pthread_*` variants (L44-62)

**Opaque Types (L31-38, L78-85)**: Empty enums with Clone/Copy for C compatibility:
- `timezone` enum for timezone handling (L31-38)
- `sem` enum for semaphore operations (L78-85)

### System Structures

**Core Data Structures (L95-453)**: Comprehensive C structure definitions in `s!` macro:
- Time structures: `itimerspec`, `tm`, `timespec` variants (L96-134)
- Process/user data: `passwd`, `ucred` (L136-156)  
- Network structures: `sockaddr_*`, `addrinfo`, `msghdr` variants (L158-209)
- File system: `stat`, `statvfs`, `statfs` (L385-452)
- Threading: CPU sets, signal contexts, thread attributes

**Special Alignment Structures (L302-352, L364-371)**: Platform-specific register contexts:
- `mcontext_t` with 16-byte alignment for CPU context (L302-352)
- `ucontext_t` with 8-byte alignment for signal context (L364-371)

### No-Traits Structures (L455-522)

Structures without automatic trait derivation using `s_no_extra_traits!`:
- `max_align_t` for maximum alignment requirements (L456-459)
- `siginfo_t` for signal information (L461-468)
- Network interface unions: `__c_anonymous_ifr_ifru`, `ifreq` (L470-488)
- Directory and Unix socket structures (L500-521)

### Signal Information Methods (L524-571)

Implementation of accessor methods for `siginfo_t` union fields:
- `si_addr()` - fault address for memory violations (L525-536)
- `si_status()` - exit status for child processes (L538-549)  
- `si_pid()`, `si_uid()` - process/user identifiers (L551-557)
- `si_value()` - signal value payload (L559-570)

### Conditional Trait Implementations (L573-687)

Feature-gated trait implementations under `cfg_if!` for `extra_traits`:
- Hash, PartialEq, Eq for `siginfo_t`, `dirent`, `sockaddr_un`, `utsname` (L574-686)
- Custom equality logic handling array comparisons and padding fields

### System Constants (L689-1772)

Extensive constant definitions organized by domain:
- File descriptor limits: `FD_SETSIZE = 1024` (L689)
- Signal constants: `SIGHUP = 1` through `SIGUSR2 = 31` (L719-750)
- Socket options and protocols: `SOL_SOCKET`, `AF_*`, `PF_*` families (L824-894)
- File permissions and operations: `S_*` mode bits (L982-1006)
- Error codes: Complete errno mapping (L1565-1687)
- Network protocols: IP, IPv6, TCP options (L908-980, L1030-1067)

### Utility Functions (L1773-1933)

**File Descriptor Operations (L1774-1796)**: FD_SET manipulation macros converted to functions:
- `FD_CLR()`, `FD_ISSET()`, `FD_SET()`, `FD_ZERO()` for select operations

**CPU Set Operations (L1798-1850)**: CPU affinity management:
- `CPU_ALLOC_SIZE()`, `CPU_COUNT_S()`, `CPU_ZERO()` (L1798-1816)
- `CPU_SET()`, `CPU_CLR()`, `CPU_ISSET()` for CPU mask manipulation (L1818-1850)

**Message Control Functions (L1852-1881)**: Socket control message handling:
- `CMSG_LEN()`, `CMSG_SPACE()` for size calculations (L1852-1858)
- `CMSG_FIRSTHDR()`, `CMSG_NXTHDR()`, `CMSG_DATA()` for traversal (L1860-1881)

**Safe Utility Functions (L1883-1929)**: Const functions for system operations:
- Device number manipulation: `makedev()`, `major()`, `minor()` (L1884-1896)
- Process status checking: `WIFEXITED()`, `WIFSIGNALED()`, etc. (L1898-1928)

### External Function Declarations (L1935-2477)

Comprehensive `extern "C"` function bindings organized by category:
- Signal handling: `sigwait()`, `pthread_sigmask()`, `sigaltstack()` (L1936-1948)
- Time operations: `strftime()`, `clock_*()`, `timer_*()` functions (L1950-1991)
- Process management: priority, limits, user/group operations (L1993-2016)
- Network I/O: socket operations, address resolution (L2039-2076)
- Threading: pthread operations, CPU affinity (L2179-2331)
- File operations: POSIX spawn, advisory operations (L2348-2476)

### Architecture Notes

- **Cygwin-specific**: Comments indicate non-standard behaviors (L711, L812)
- **Platform adaptations**: Some constants marked as missing on Cygwin
- **Memory alignment**: Critical for x86-64 compatibility with Windows ABI
- **Function naming**: Links to specific implementations (L2150, L2154)