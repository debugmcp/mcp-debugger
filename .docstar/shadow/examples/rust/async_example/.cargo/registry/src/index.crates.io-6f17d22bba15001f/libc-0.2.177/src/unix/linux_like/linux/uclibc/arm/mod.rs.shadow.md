# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/arm/mod.rs
@source-hash: a90c7811623714e1
@generated: 2026-02-09T17:57:09Z

## Platform-Specific Type Definitions and Constants for uClibc ARM Linux

This file provides ARM-specific type definitions, data structures, and system constants for the uClibc C library implementation on Linux. It serves as a crucial interface layer between Rust and the underlying ARM Linux system calls and C library functions.

### Primary Components

**Type Aliases (L4-23)**: Core C type mappings including `wchar_t`, `time_t`, `clock_t`, filesystem types (`fsblkcnt_t`, `fsfilcnt_t`), and process types (`pthread_t`, `pid_t`). These establish the fundamental data type compatibility between Rust and ARM uClibc.

**System Structures (L24-255)**: Critical system data structures wrapped in the `s!` macro:
- **Socket Communication**: `cmsghdr` (L25-29) and `msghdr` (L31-39) for socket control and message headers
- **File System**: `stat` (L45-66) and `stat64` (L68-88) for file metadata, `statfs`/`statfs64` (L115-144) for filesystem information
- **Process Management**: `pthread_attr_t` (L41-43), `sigaction` (L168-173), `siginfo_t` (L186-191)
- **IPC**: `ipc_perm` (L199-211), `msqid_ds` (L213-228), `shmid_ds` (L230-244) for inter-process communication
- **Terminal Control**: `termios` (L175-184) for terminal I/O settings
- **Synchronization**: `sem_t` (L249-254) with conditional sizing based on pointer width

**System Constants (L257-544)**: Extensive collection of system-level constants including:
- File operation flags (`O_CLOEXEC`, `O_APPEND`, etc.)
- Thread sizing constants (`__SIZEOF_PTHREAD_*`)
- Terminal control flags (`NCCS`, baud rates B0-B4000000)
- Error codes (EADDRINUSE, ECONNREFUSED, etc.)
- Signal handling constants (`SA_*`, `SIG_*`)

**System Call Numbers (L547-925)**: Complete ARM syscall table mapping syscall names to numbers, enabling direct system call invocation from Rust. Ranges from basic operations (`SYS_read`, `SYS_write`) to modern features (`SYS_landlock_*`, `SYS_futex_waitv`).

### Architectural Considerations

The file includes ARM-specific memory layout details, particularly in `sem_t` structure sizing (L250-253) which adapts to 32/64-bit pointer widths. Socket and file handling structures maintain ARM-specific field ordering and padding requirements.

### Dependencies

- Imports `off64_t` and prelude types from parent crate modules (L1-2)
- References numerous `crate::` types throughout structures, indicating tight integration with the broader libc crate ecosystem