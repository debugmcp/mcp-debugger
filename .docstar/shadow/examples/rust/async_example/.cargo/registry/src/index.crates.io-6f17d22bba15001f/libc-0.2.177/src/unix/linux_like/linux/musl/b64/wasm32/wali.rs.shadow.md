# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b64/wasm32/wali.rs
@source-hash: 69e0d06289f1c868
@generated: 2026-02-09T17:57:05Z

This file provides WebAssembly Linux Interface (WALI) syscall bindings for the musl libc implementation targeting wasm32 architecture. It serves as a bridge between Rust code and WASI-like system calls in WebAssembly environments.

**Primary Purpose**: Defines FFI declarations for Linux system calls accessible through WebAssembly's import mechanism, enabling standard POSIX operations in wasm32/musl environments.

**Architecture Pattern**: All functions follow a consistent pattern:
- Imported from the "wali" WebAssembly module via `#[link(wasm_import_module = "wali")]` (L4)
- Use C calling convention (`extern "C"`) (L5)
- Named with `__syscall_SYS_*` prefix and linked to corresponding `SYS_*` symbols
- Return `::c_long` (typically error codes or success values)
- Take platform-specific integer arguments (i32, u32, i64, u64)

**Key System Call Categories**:

**File Operations** (L7-26, L173-213):
- Basic I/O: `__syscall_SYS_read/write/open/close` (L8-17)
- File metadata: `__syscall_SYS_stat/fstat/lstat` (L19-26)
- File control: `__syscall_SYS_fcntl/flock/fsync` (L173-183)
- Directory operations: `__syscall_SYS_mkdir/rmdir/chdir` (L203-207, L194-198)

**Memory Management** (L34-44, L82-89):
- Virtual memory: `__syscall_SYS_mmap/munmap/mprotect` (L34-41)
- Memory advice: `__syscall_SYS_madvise/msync/mremap` (L82-89)
- Heap management: `__syscall_SYS_brk` (L43-44)

**Process/Thread Control** (L155-171, L245-294, L323-327):
- Process lifecycle: `__syscall_SYS_fork/execve/exit/wait4` (L155-165)
- Process IDs: `__syscall_SYS_getpid/getppid/gettid` (L106-107, L266-267, L323-324)
- User/group management: `__syscall_SYS_getuid/setuid/getgid/setgid` series (L245-288)

**Signal Handling** (L46-53, L296-303):
- Real-time signals: `__syscall_SYS_rt_sigaction/rt_sigprocmask` (L46-50)
- Signal stack: `__syscall_SYS_sigaltstack` (L302-303)

**Network Operations** (L109-153):
- Socket creation: `__syscall_SYS_socket/bind/listen/accept` (L109-116, L134-138)
- Data transfer: `__syscall_SYS_sendto/recvfrom/sendmsg/recvmsg` (L118-129)
- Socket options: `__syscall_SYS_setsockopt/getsockopt` (L149-153)

**Advanced I/O** (L356-441):
- Directory-relative operations: `__syscall_SYS_openat/fstatat/unlinkat` series (L359-387)
- Event polling: `__syscall_SYS_epoll_create1/epoll_ctl/epoll_pwait` (L356-407, L418-419)
- Modern syscalls: `__syscall_SYS_statx/getrandom/faccessat2` (L436-440)

**Time Management** (L344-354):
- Clock operations: `__syscall_SYS_clock_gettime/clock_getres/clock_nanosleep` (L344-351)

**Critical Constraints**:
- All syscalls are imported from external WebAssembly host environment
- Parameter types are fixed to WebAssembly-compatible integers
- Syscall numbers in comments correspond to Linux x86_64 syscall table
- Some syscall numbers are non-consecutive (gaps indicate unsupported syscalls)
- Generated code - modifications should be done in autogen.py script (L3)

**Dependencies**: Links to libc's `c_long` type, requires WALI runtime environment for WebAssembly host to provide syscall implementations.