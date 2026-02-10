# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/aix/powerpc64.rs
@source-hash: 45614bea9cf2732f
@generated: 2026-02-09T18:02:23Z

**Purpose**: Platform-specific type definitions and constants for AIX PowerPC 64-bit architecture in the libc crate. This file provides FFI bindings for system structures, unions, and constants that match the AIX operating system's C library interface.

**Key Dependencies**:
- Uses `crate::off_t` and `crate::prelude::*` (L1-2)
- References numerous crate-internal types like `pid_t`, `dev_t`, `uid_t`, etc.

**Architecture Pattern**: Uses libc's macro system with `s!{}` (L10-248) for regular structs and `s_no_extra_traits!{}` (L250-349) for types that need custom trait implementations due to containing function pointers or unions.

**Key Structure Categories**:

**System I/O & File Operations**:
- `sigset_t` (L11-13): Signal set with 4 unsigned longs
- `fd_set` (L15-17): File descriptor set with 1024 long bits
- `flock` (L19-27): File locking structure
- `stat` (L62-84): File status information with AIX-specific fields
- `statfs`/`statvfs` (L86-105, L29-44): File system statistics

**Threading Primitives**:
- `pthread_mutex_t` (L54-56): 8-element long array
- `pthread_cond_t` (L50-52): 6-element long array  
- `pthread_rwlock_t` (L46-48): 10-element long array
- `pthread_once_t` (L58-60): 9-element long array
- `pthread_spinlock_t` (L224-226): 3-element long array
- `pthread_barrier_t` (L228-230): 5-element long array

**Signal Handling**:
- `siginfo_t` (L251-263): Signal information with accessor methods (L351-371)
- Custom PartialEq/Hash implementations when `extra_traits` feature enabled (L375-403)

**Process Context & CPU State**:
- `__context64` (L165-182): 64-bit PowerPC CPU context
- `mcontext_t` (L184-186): Machine context wrapper
- `ucontext_t` (L199-209): User context with signal mask and stack
- `__vmx_context_t` (L129-135): VMX/AltiVec vector context
- `__vsx_context_t` (L137-139): VSX vector context
- `__tm_context_t` (L141-163): Transactional Memory context

**Async I/O**:
- `aiocb` (L107-123): Asynchronous I/O control block

**System Information**:
- `utmpx` (L211-222): Extended utmp structure for login records
- `msqid_ds` (L232-247): Message queue descriptor

**Kernel Structures** (in s_no_extra_traits!):
- `file` (L296-314): Kernel file descriptor structure
- `fileops_t` (L270-294): File operations function pointers
- `ld_info` (L322-331): Dynamic loader information
- `_kernel_simple_lock` union (L265-268): Kernel locking primitive

**Constants**:
- pthread initializers (L459-471): Static initializers for threading primitives
- `RLIM_INFINITY` (L473): Resource limit infinity value
- `PTHREAD_ONCE_INIT` (L469-471): Once initialization constant

**External Functions**:
- `getsystemcfg` (L476): AIX system configuration query function

**Feature-Gated Implementations**: Conditional trait implementations for PartialEq, Eq, and Hash when `extra_traits` feature is enabled (L373-457), with special unsafe handling for union types like `__pollfd_ext_u`.