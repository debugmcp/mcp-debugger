# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/sparc/mod.rs
@source-hash: d8fc8800d01891bb
@generated: 2026-02-09T17:57:00Z

**Primary Purpose**: SPARC 32-bit architecture-specific type definitions and constants for GNU Linux systems, part of the libc crate's platform abstraction layer.

**Key Types and Structures**:
- `wchar_t` (L6): Wide character type defined as 32-bit signed integer
- `sigaction` (L11-16): Signal handler configuration with function pointer, mask, flags, and optional restorer
- `statfs`/`statfs64` (L18-33, L112-125): Filesystem statistics structures, 64-bit version uses u64 for block counts
- `siginfo_t` (L35-41): Signal information with 29-word padding for alignment
- `flock`/`flock64` (L43-58): File locking structures using off_t/off64_t respectively
- `stat`/`stat64` (L66-110): File metadata structures with conditional compilation based on file offset bits
- `ipc_perm` (L143-155): IPC permission structure with user/group IDs and sequence numbers
- `shmid_ds`/`msqid_ds` (L157-197): Shared memory and message queue descriptors with time field conditionals
- `max_align_t` (L202-204): Maximum alignment type with 8-byte alignment and 3 64-bit integers

**Constants Categories**:
- **File Operations** (L207-220): O_APPEND, O_CREAT, O_SYNC etc. with SPARC-specific values
- **Memory Management** (L222-232): MAP_GROWSDOWN, MAP_ANON, MAP_HUGETLB flags
- **Error Codes** (L234-311): Comprehensive errno values specific to SPARC architecture
- **Socket Types** (L313-314): SOCK_STREAM, SOCK_DGRAM definitions
- **Signal Handling** (L316-341): Signal action flags and signal numbers
- **Terminal Control** (L343-474): Extensive terminal I/O control flags and baud rates
- **System Calls** (L476-865): Complete syscall number mappings for SPARC Linux

**Architecture Dependencies**:
- Uses conditional compilation with `gnu_file_offset_bits64` and `gnu_time_bits64` features
- SPARC-specific signal numbers (SIGEMT=7, different from other architectures)
- Platform-specific syscall numbers and memory layout considerations
- Imports `off64_t`, `off_t` from crate root for file offset types

**Notable Patterns**:
- Extensive use of `s!` macro for structure definitions (likely for C compatibility)
- `s_no_extra_traits!` for types requiring custom trait implementations
- Conditional field placement based on compile-time features
- Reserved/padding fields for ABI compatibility (`__pad*`, `__reserved*`)