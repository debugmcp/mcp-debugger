# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/powerpc.rs
@source-hash: 92089167ddbe1fde
@generated: 2026-02-09T17:57:06Z

This file provides PowerPC 32-bit specific type definitions and constants for the musl C library in a Linux-like environment. It's part of the libc crate's platform-specific implementation layer.

## Primary Purpose
Architecture-specific definitions for PowerPC 32-bit systems running Linux with musl libc, including system structures, constants, and syscall numbers.

## Key Type Definitions
- **wchar_t (L4)**: Wide character type defined as i32 for PowerPC
- **termios (L7-16)**: Terminal I/O control structure with flags and character arrays
- **stat/stat64 (L18-58)**: File status structures with metadata fields like size, timestamps, permissions
- **stack_t (L60-64)**: Signal stack structure for alternate signal handling
- **ipc_perm (L66-85)**: IPC permission structure with version-dependent field naming (musl_v1_2_3 feature flag)
- **shmid_ds (L87-102)**: Shared memory segment descriptor
- **msqid_ds (L104-119)**: Message queue descriptor

## Constants Categories

### Memory and File Operations (L122-221)
- Memory advice: MADV_SOFT_OFFLINE
- Signal stack sizes: SIGSTKSZ, MINSIGSTKSZ
- File flags: O_DIRECT, O_DIRECTORY, O_LARGEFILE, etc.
- Memory locking: MCL_CURRENT, MCL_FUTURE, MCL_ONFAULT
- Memory mapping: MAP_ANON, MAP_GROWSDOWN, MAP_HUGETLB, etc.

### Terminal Control (L135-201)
Extensive terminal control flags and baud rates including:
- Control flags: CBAUD, CSIZE, CREAD, PARENB
- Local flags: ECHOE, ICANON, ISIG
- Baud rates: B57600 through B4000000

### Error Codes (L229-313)
Complete set of POSIX error constants (EDEADLK, ENAMETOOLONG, etc.) with PowerPC-specific values.

### Signals (L315-342)
Signal handling constants including signal numbers (SIGCHLD=17, SIGUSR1=10) and signal action flags.

### System Calls (L363-766)
Complete syscall table from SYS_restart_syscall (0) through SYS_mseal (462), including deprecated syscalls with appropriate deprecation annotations.

## Notable Features
- Conditional compilation for musl version differences (L67-75)
- Deprecated field warnings for API evolution
- Comprehensive syscall coverage including modern additions (io_uring, landlock, etc.)
- PowerPC-specific values that may differ from other architectures

## Dependencies
- Imports common types from crate root and prelude
- Uses `s!` macro for structure definitions (likely from parent modules)
- Relies on feature flags for version-specific behavior

This file serves as the foundation for low-level system programming on PowerPC 32-bit Linux systems using musl libc.