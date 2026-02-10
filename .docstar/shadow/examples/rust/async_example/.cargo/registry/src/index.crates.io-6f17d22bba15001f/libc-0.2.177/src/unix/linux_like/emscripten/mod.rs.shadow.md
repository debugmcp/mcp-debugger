# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/emscripten/mod.rs
@source-hash: fab8e539c9681b44
@generated: 2026-02-09T17:58:44Z

Emscripten-specific platform types and constants for POSIX/Linux-like functionality. This module defines the low-level system interface bindings for Emscripten (WebAssembly compilation target), providing Unix/Linux compatibility in the browser environment.

## Type Definitions (L3-51)

**Core Platform Types (L3-30):**
- Standard integer type aliases (`wchar_t`, `useconds_t`, `dev_t`, etc.) mapping C types to Rust equivalents
- Threading types (`pthread_t`, `pthread_key_t`) for pthread compatibility
- File system types (`mode_t`, `ino_t`, `off_t`, `blkcnt_t`) for POSIX file operations
- Time types (`clock_t`, `time_t`, `suseconds_t`) for temporal operations

**64-bit Type Aliases (L32-42):**
- Maps 64-bit variants to their base types (`ino64_t = crate::ino_t`)
- Struct aliases for 64-bit file operations (`stat64 = crate::stat`, `flock64 = crate::flock`)

**Incomplete Type (L44-51):**
- `fpos64_t` enum marked as incomplete with FIXME comment - placeholder implementation

## Structure Definitions (L53-388)

**File System Structures:**
- `glob_t` (L54-65): Pattern matching results with path array and flags
- `stat` (L228-251): File metadata with conditional compilation for old ABI compatibility
- `statfs`/`statvfs` (L89-103, L286-299): File system statistics

**User/Group Management:**
- `passwd` (L67-75): User account information
- `spwd` (L77-87): Shadow password entries

**System Information:**
- `sysinfo` (L353-368): System resource usage and statistics
- `signalfd_siginfo` (L105-128): Signal information for signalfd

**IPC Structures:**
- `ipc_perm` (L170-180): System V IPC permissions
- `shmid_ds` (L259-270): Shared memory segment descriptor
- `msqid_ds` (L272-284): Message queue descriptor
- `msginfo` (L144-153): Message queue limits
- `sembuf` (L155-159): Semaphore operation structure

**Threading Primitives:**
- `pthread_attr_t` (L201-203): Thread attributes (opaque)
- `pthread_mutex_t` (L319-321): Mutex with size-based storage
- `pthread_rwlock_t` (L324-326): Reader-writer lock
- `pthread_cond_t` (L380-382): Condition variable with alignment requirements

**Signal Handling:**
- `sigaction` (L163-168): Signal handler configuration
- `sigset_t` (L205-207): Signal mask
- `siginfo_t` (L301-307): Signal information
- `stack_t` (L253-257): Signal stack information

**Networking:**
- `msghdr` (L209-217): Socket message header
- `cmsghdr` (L219-223): Control message header

## Constants (L490-1586)

**System Configuration (L565-730):**
- `_PC_*` constants: Path configuration limits
- `_SC_*` constants: System configuration parameters
- POSIX feature test macros and limits

**File Operations (L734-761, L892-1212):**
- `GLOB_*`: Pattern matching flags
- `O_*`: File open flags (append, create, exclusive, etc.)
- `F_*`: File control operations (lock, get/set owner)

**Error Constants (L897-1031):**
- Comprehensive errno values mapped to WASI equivalents
- Linux-specific error codes for compatibility

**Signal Constants (L1033-1281):**
- `SA_*`: Signal action flags
- `SIG*`: Signal numbers and manipulation constants

**Terminal I/O (L1072-1169, L1303-1332):**
- `TC*`: Terminal control operations
- `TIOC*`: Terminal I/O control codes
- Baud rate constants (`B*`)
- Terminal flags for input/output processing

**Networking (L803-870, L1171-1250):**
- Address family constants (`AF_*`, `PF_*`)
- Socket options (`SO_*`)
- Name resolution flags (`AI_*`, `NI_*`, `EAI_*`)

**Memory Management (L1216-1225, L1284):**
- `MAP_*`: Memory mapping flags
- `MADV_*`: Memory advice constants

**Threading (L779-801):**
- `PTHREAD_*`: Thread synchronization constants
- Scheduler policy constants (`SCHED_*`)

## Function Implementations (L1364-1440)

**CPU Set Operations (L1378-1406):**
- `CPU_ZERO`, `CPU_SET`, `CPU_CLR`, `CPU_ISSET`, `CPU_EQUAL`: CPU affinity mask manipulation

**Device Number Handling (L1410-1439):**
- `makedev`, `major`, `minor`: Device number composition/decomposition

**Message Processing (L1365-1376):**
- `CMSG_NXTHDR`: Control message iteration for socket programming

## External Function Declarations (L1442-1585)

Extensive extern "C" block declaring system calls and library functions:
- Resource management (`getrlimit`, `setrlimit`)
- Memory operations (`mprotect`, `mremap`, `madvise`)
- File operations (`posix_fallocate`, `glob`, `ioctl`)
- Network programming (`accept4`, `sendmmsg`, `recvmmsg`)
- User/group management (`getpwnam_r`, `getgrnam_r`)
- Threading (`pthread_create`)
- System information (`gettimeofday`, `getloadavg`)

## Architecture Notes

- **Emscripten Compatibility**: Types and constants chosen to maintain source compatibility with Linux/POSIX while running in WebAssembly
- **Conditional Compilation**: Uses `#[cfg(emscripten_old_stat_abi)]` for ABI compatibility
- **Size-based Storage**: Threading primitives use byte arrays with platform-specific sizing constants
- **WASI Error Mapping**: Error constants map to WebAssembly System Interface values rather than traditional Linux errno values