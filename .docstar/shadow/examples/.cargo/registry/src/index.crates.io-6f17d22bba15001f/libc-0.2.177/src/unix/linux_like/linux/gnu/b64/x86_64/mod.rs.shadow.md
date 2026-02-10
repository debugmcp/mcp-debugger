# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/x86_64/mod.rs
@source-hash: deb7d1bb4639e0ad
@generated: 2026-02-09T17:57:18Z

## x86_64 GNU Linux Platform Definitions

This file provides x86_64-specific type definitions and system constants for 64-bit GNU Linux systems. It's part of the libc crate's platform abstraction layer, containing low-level bindings to C library types and constants.

### Type Definitions (L6-12)
Defines fundamental platform-specific type aliases:
- `wchar_t = i32`: Wide character type 
- `nlink_t = u64`: Number of hard links type
- `blksize_t = i64`: Block size type
- `greg_t = i64`: General register type
- `suseconds_t = i64`: Microseconds type
- `__u64 = c_ulonglong`, `__s64 = c_longlong`: 64-bit kernel types

### Core System Structures (L14-289)
Comprehensive collection of C-compatible structs for system programming:

**Signal Handling:**
- `sigaction` (L17-24): Signal handler configuration with function pointer, mask, flags, and restorer
- `siginfo_t` (L58-71): Signal information with deprecated `_pad` field
- `stack_t` (L73-77): Signal stack configuration

**File System:**
- `stat` (L79-98): File metadata with standard POSIX fields plus nanosecond timestamps
- `stat64` (L100-119): 64-bit version using `ino64_t` and `blkcnt64_t`
- `statfs` (L26-40), `statfs64` (L121-134), `statvfs64` (L136-149): File system statistics
- `flock` (L42-48), `flock64` (L50-56): File locking structures

**Process/Thread Context:**
- `user_regs_struct` (L182-210): Complete x86_64 register set for debugging/ptrace
- `user` (L212-232): Process debugging information structure
- `mcontext_t` (L234-238): Machine context for signal handling
- `pthread_attr_t` (L151-156): Thread attribute structure

**IPC/Memory:**
- `ipc_perm` (L240-252): IPC permissions structure
- `shmid_ds` (L254-265): Shared memory segment descriptor
- `clone_args` (L275-288): Modern clone system call arguments

### Floating Point Support (L158-180, L292-304)
x86_64 FPU state structures:
- `_libc_fpxreg`, `_libc_xmmreg`, `_libc_fpstate`: FPU register representations
- `user_fpregs_struct`: User-space FPU state for debugging

### Special Trait Implementations (L306-389)
Conditional implementations of `PartialEq`, `Eq`, and `Hash` for structures containing large arrays or padding, with explicit handling of private/padding fields.

### System Constants (L391-793)
Extensive collection of platform-specific constants:

**File Operations:** O_APPEND, O_CREAT, O_SYNC, etc. (L399-411)
**Error Codes:** Complete errno definitions (L415-492) 
**Signal Constants:** Signal numbers and handling flags (L497-526)
**Memory Management:** MAP_* and MCL_* flags (L597-642)
**Terminal Control:** Comprehensive termios constants (L644-738)
**Register Offsets:** x86_64 register indices for debugging (L741-792)

### External Functions (L794-799)
Context manipulation functions: `getcontext`, `setcontext`, `makecontext`, `swapcontext`

### Conditional Module Loading (L801-809)
Architecture-specific module selection based on pointer width (32-bit x32 vs 64-bit)

This file serves as the foundational layer for x86_64 GNU Linux system programming in Rust, providing safe access to low-level system interfaces.