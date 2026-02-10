# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/mod.rs
@source-hash: fa5c797fb3f57b63
@generated: 2026-02-09T17:58:31Z

## NetBSD-like Unix System Types and Constants

This module defines system-level types, constants, and function bindings for NetBSD-like Unix systems (NetBSD and OpenBSD). Part of the libc crate's Unix BSD abstraction layer.

### Type Definitions (L4-18)
- Fundamental system types: `wchar_t`, `time_t`, `mode_t`, `nlink_t`, `ino_t` (L4-8)
- Threading and synchronization: `pthread_key_t`, `sem_t` (L9, L16)  
- Resource limits: `rlim_t` (L10)
- Terminal control: `speed_t`, `tcflag_t` (L11-12)
- Locale: `nl_item` (L13)
- Clock/timer: `clockid_t` (L14)
- Process/IPC: `id_t`, `key_t` (L15, L17)

### Opaque Handle Enums (L19-34)
- `timezone` (L20): Empty enum for timezone handle with manual Copy/Clone implementations
- `sem` (L28): Empty enum for semaphore handle with manual Copy/Clone implementations

### Core System Structures (L36-103)
Defined using the `s!` macro for C struct compatibility:
- `sched_param` (L37): Scheduler parameters with priority field
- `sigaction` (L41): Signal handler configuration
- `stack_t` (L47): Signal stack specification
- `in6_pktinfo` (L53): IPv6 packet information
- `termios` (L58): Terminal I/O attributes with control flags and speeds
- `flock` (L68): File locking structure with position and type
- `ipc_perm` (L76): IPC permissions with conditional NetBSD/OpenBSD field differences
- `ptrace_io_desc` (L92): Process tracing I/O descriptor
- `mmsghdr` (L99): Multiple message header for sendmmsg/recvmmsg

### Constants
- **Locale constants** (L105-162): Date/time formatting, weekdays, months, character sets
- **Standard I/O** (L164-177): Exit codes, EOF, seek modes, buffer settings  
- **File system** (L178-212): File modes, permissions (octal constants), access tests
- **Signals** (L216-227): Standard Unix signal numbers
- **Memory protection** (L229-241): mmap protection and mapping flags
- **IPC** (L243-258): Inter-process communication flags and permissions
- **Error codes** (L265-346): Complete errno constant definitions
- **File control** (L348-352): fcntl command constants
- **Network** (L471-586): Address families, socket types, protocol options, message flags
- **System limits** (L414-426): Resource limit constants and values
- **Terminal I/O** (L628-689): Baud rates and terminal control ioctl commands

### Function Helper Macros (L452-469)
- `_IO()`, `_IOR<T>()`, `_IOW<T>()`, `_IOWR<T>()`: Build ioctl command numbers for different I/O directions

### External Function Bindings (L699-893)
Two extern blocks define C library function bindings:

1. **util library functions** (L699-871): System utilities, threading, process control, POSIX spawn
2. **libc functions** (L873-893): Memory management, host identification, entropy, message handling

### Platform-Specific Modules (L895-905)
Conditional compilation includes NetBSD or OpenBSD specific definitions based on target OS.

### Key Architectural Patterns
- Uses empty enums for opaque C handles to prevent invalid construction
- Leverages `s!` macro for C-compatible struct layouts  
- Extensive use of conditional compilation for OS-specific differences
- Separates constants by functional domain (filesystem, networking, IPC, etc.)
- Manual trait implementations for Copy/Clone on opaque types