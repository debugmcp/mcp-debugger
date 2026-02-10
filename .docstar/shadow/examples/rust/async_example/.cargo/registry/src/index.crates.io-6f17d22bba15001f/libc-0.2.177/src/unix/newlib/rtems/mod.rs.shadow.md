# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/newlib/rtems/mod.rs
@source-hash: 6e26c8d4ce78557b
@generated: 2026-02-09T17:58:20Z

## RTEMS-Specific libc Bindings Module

Platform-specific definitions for RTEMS (Real-Time Executive for Multiprocessor Systems) in the libc crate. This module provides RTEMS-specific constants, structures, and function bindings that differ from standard Unix implementations.

### Core Components

**Socket Structure**
- `sockaddr_un` (L6-9): Unix domain socket address structure with 108-byte path buffer

**File/Directory Operations**
- `AF_UNIX` (L12): Unix domain socket family constant
- `RTLD_DEFAULT` (L14): Dynamic linker default handle (-2 cast to void pointer)
- `UTIME_OMIT` (L16): Special timestamp value for omitting file time updates
- `AT_FDCWD` (L17): File descriptor for current working directory
- Directory/symlink flags (L19-25): `O_DIRECTORY`, `O_NOFOLLOW`, `AT_*` constants

**Signal Handling**
- Signal mask operations (L28-30): `SIG_BLOCK`, `SIG_UNBLOCK`, `SIG_SETMASK`
- Standard signals (L31-63): Complete signal enumeration including POSIX and RTEMS-specific signals
- Signal action flags (L65-67): `SA_NOCLDSTOP`, `SA_SIGINFO`, `SA_ONSTACK`
- Notable overlap: `SIGCHLD` and `SIGCLD` both map to 20 (L50-51)

**Network/System Configuration**
- Address info errors (L69-74): EAI_* constants for getaddrinfo failures
- System configuration (L76-78): Page size and thread stack constants
- Wait options (L81-82): `WNOHANG`, `WUNTRACED` for process waiting
- Socket limits (L85): `SOMAXCONN` maximum connection queue

### Wait Status Macros

**Process Status Functions** (L87-122)
- `WIFSTOPPED`, `WSTOPSIG`: Detect stopped processes
- `WIFSIGNALED`, `WTERMSIG`: Detect signal termination  
- `WIFEXITED`, `WEXITSTATUS`: Detect normal exit
- `WIFCONTINUED` (L114-116): RTEMS-specific stub (always returns true)
- `WCOREDUMP` (L119-121): RTEMS-specific stub (always returns false)

### External Function Bindings

**File I/O** (L125-127)
- `futimens`: Set file timestamps
- `writev`, `readv`: Vectored I/O operations

**Threading** (L129-139)
- `pthread_create`: Thread creation
- `pthread_condattr_setclock`: Condition variable clock setup

**Security/Random** (L141-143)
- `getentropy`: Secure random number generation
- `arc4random_buf`: Random buffer filling

**Process Management** (L145)
- `setgroups`: Set supplementary group IDs

### Architecture Notes

- Uses `s!` macro for struct definitions (libc crate pattern)
- Uses `safe_f!` macro for safe const function definitions
- RTEMS lacks native `WIFCONTINUED` and `WCOREDUMP` support, replaced with stubs
- All functions use C ABI calling convention