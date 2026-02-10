# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/aix/mod.rs
@source-hash: fec4d43917078c55
@generated: 2026-02-09T18:02:30Z

## AIX Platform-Specific Bindings

This file provides AIX (IBM's UNIX system) specific type definitions, constants, and external function bindings for the Rust `libc` crate. It serves as a comprehensive interface layer between Rust and the AIX operating system.

### Core Architecture

**Type Definitions (L4-61)**: Defines fundamental POSIX and AIX-specific types as aliases to C primitive types:
- Basic types: `caddr_t`, `clockid_t`, `dev_t`, `mode_t`, etc.
- Network types: `socklen_t`, `sa_family_t` (L36-37)
- Threading types: `pthread_t`, `pthread_key_t` (L40-41)
- IPC types: `sem_t`, `mqd_t`, `key_t` (L50, 45, 14)

**Enumerations (L62-76)**: Platform-specific enums using macro `e!`:
- `uio_rw`: I/O operation types (read, write, no-move variants)
- `ACTION`: Hash table search operations (FIND, ENTER)

**Structure Definitions (L78-533)**: Comprehensive system structures using macro `s!`:
- File system: `fsid_t`, `dirent`, `statvfs64` (L79-148)
- Network: `sockaddr*` family, `addrinfo`, `msghdr` (L213-351)
- Process/thread: `tm`, `passwd`, `sched_param` (L179-372)
- IPC: `shmid_ds`, `mq_attr` (L439-510)

**Advanced Structures (L535-550)**: Union and complex structures using `s_no_extra_traits!` macro for types that cannot derive standard traits automatically.

**Conditional Trait Implementations (L552-596)**: Feature-gated implementations of `PartialEq`, `Eq`, and `Hash` for union types when `extra_traits` feature is enabled.

### System Constants

The file extensively defines system constants organized by header file origin:

**File Operations (L599-661)**: `dlfcn.h`, `fcntl.h` constants for dynamic loading and file control
**Network Configuration (L756-1061)**: Socket, protocol, and network interface constants
**System Limits (L1463-1482)**: `PATH_MAX`, `PAGESIZE`, `IOV_MAX`, etc.
**Error Codes (L1212-1324)**: Comprehensive errno definitions
**Signal Handling (L1709-1805)**: Signal numbers and handling flags

### Function Interfaces

**Thread Management (L2561-2817)**: pthread functions with proper AIX linkage
**I/O Operations (L2832-3371)**: File, socket, and async I/O functions
**System Calls**: Process control, memory management, IPC operations

Notable AIX-specific aspects:
- Uses `#[link_name]` attributes for AIX-specific function mappings (L2834, L3195)
- Includes AIX-specific functions like `loadquery`, `lpar_get_info` (L3007-3008)
- Special handling for socket functions mapped to `n*` variants (L3195, L3212, L3264)

**Utility Macros (L2432-2559)**: 
- `CMSG_*` macros for control message handling
- `FD_*` macros for file descriptor set manipulation  
- `WIF*` macros for wait status checking
- Device number manipulation (`major`, `minor`, `makedev`)

**Error Handling (L3374)**: AIX-specific thread-safe errno access via `_Errno()`

**Architecture Support (L3377-3382)**: Conditional inclusion of PowerPC64-specific definitions.

This file represents a complete interface layer enabling Rust programs to interact with all major AIX system facilities including networking, file systems, processes, threads, and IPC mechanisms.