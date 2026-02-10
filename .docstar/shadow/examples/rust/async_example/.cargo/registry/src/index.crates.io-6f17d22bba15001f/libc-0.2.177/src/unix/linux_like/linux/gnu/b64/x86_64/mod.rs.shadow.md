# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/x86_64/mod.rs
@source-hash: deb7d1bb4639e0ad
@generated: 2026-02-09T17:57:12Z

**Purpose**: x86_64-specific Linux C library bindings for Rust's libc crate. Provides platform-specific type definitions, constants, and foreign function interfaces matching GNU C library APIs on 64-bit x86_64 Linux systems.

**Core Architecture**:
- Uses `s!` macro (L14) to define C-compatible structs with automatic trait derivation
- Uses `s_no_extra_traits!` macro (L291) for structs requiring manual trait implementations
- Conditionally includes x32 vs not_x32 modules based on pointer width (L801-809)

**Key Type Definitions**:
- Primitive types (L6-12): `wchar_t`, `nlink_t`, `blksize_t`, `greg_t`, `suseconds_t`, `__u64`, `__s64`
- System call structures:
  - `sigaction` (L17-24): Signal handler configuration with function pointers
  - `stat`/`stat64` (L79-119): File metadata structures for 32/64-bit file operations
  - `statfs`/`statfs64`/`statvfs64` (L26-149): Filesystem information structures
  - `flock`/`flock64` (L42-56): File locking structures for advisory locking

**Process/Thread Control**:
- `siginfo_t` (L58-71): Signal information with deprecated `_pad` field
- `stack_t` (L73-77): Signal stack configuration
- `pthread_attr_t` (L151-156): Thread attributes with pointer-width conditional sizing
- `clone_args` (L276-288): Modern process/thread creation parameters

**x86_64 CPU Context**:
- `user_regs_struct` (L182-210): Complete x86_64 register set for ptrace/debugging
- `user_fpregs_struct` (L292-304): Floating-point register state
- `_libc_fpstate`/`_libc_fpxreg`/`_libc_xmmreg` (L158-180): Low-level FPU/SSE state
- `mcontext_t`/`ucontext_t` (L234-318): Signal context and user context switching

**IPC Structures**:
- `ipc_perm` (L240-252): System V IPC permissions
- `shmid_ds` (L254-265): Shared memory segment metadata
- `ptrace_rseq_configuration` (L267-273): Restartable sequences configuration

**Constants by Category**:
- File operations: `O_*` flags (L399-411), `F_*` commands (L538-549)
- Error codes: Complete errno definitions (L415-492)
- Signals: Signal numbers and SA_* flags (L497-525, L580-583)
- Memory mapping: `MAP_*` flags including x86_64-specific `MAP_32BIT` (L597-608)
- Terminal I/O: Comprehensive termios flags and baud rates (L646-738)
- Register offsets: Both ptrace and ucontext register indexing (L741-792)

**Foreign Functions** (L794-799):
- `getcontext`/`setcontext`/`makecontext`/`swapcontext`: POSIX user context manipulation

**Trait Implementations**:
- Conditional `PartialEq`/`Eq`/`Hash` for `user_fpregs_struct` and `ucontext_t` (L327-388)
- Manual implementations ignore padding fields to ensure semantic equality

**Dependencies**:
- `crate::prelude::*`: Core libc types and macros
- `crate::{off64_t, off_t}`: File offset types from parent modules

**Architecture Notes**:
- Optimized for x86_64 GNU/Linux with glibc compatibility
- Contains SPARC64-specific conditionals (L20) despite being x86_64 module
- Includes deprecated symbols (`SIGUNUSED`) for backward compatibility
- Shadow stack support deliberately omitted pending glibc >= 2.28 requirement (L313-317)