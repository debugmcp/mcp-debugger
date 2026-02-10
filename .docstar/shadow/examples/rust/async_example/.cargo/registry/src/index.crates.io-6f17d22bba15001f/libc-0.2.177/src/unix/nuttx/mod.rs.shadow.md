# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/nuttx/mod.rs
@source-hash: 137c69eca97ba9e0
@generated: 2026-02-09T18:03:26Z

## Purpose and Responsibility

NuttX platform-specific type definitions and bindings for the libc crate. This module provides FFI (Foreign Function Interface) bindings to NuttX RTOS system calls, POSIX-compatible structures, and constants. It serves as the low-level interface layer between Rust code and NuttX kernel APIs.

## Key Type Definitions (L4-28)

**Primitive Types**: Standard POSIX types aliased to Rust primitives:
- File system types: `ino_t`, `dev_t`, `off_t`, `mode_t` (L5,10,15,13)
- Threading types: `pthread_t`, `pthread_key_t`, `pthread_mutexattr_t` (L19,16,17)  
- Network types: `sa_family_t`, `socklen_t` (L21,22)
- Time types: `time_t`, `clock_t`, `clockid_t` (L27,9,26)

## Core Data Structures (L30-239)

**File System Structures**:
- `stat` (L31-46): File metadata with NuttX-specific reserved space
- `statvfs` (L150-163): File system statistics
- `dirent` (L165-168): Directory entry with type and name fields

**Network Structures**:
- `sockaddr` family (L48-51, L200-223): Socket addressing structures
- `sockaddr_in/in6` (L200-213): IPv4/IPv6 socket addresses  
- `ip_mreq/ipv6_mreq` (L225-233): Multicast group membership

**Threading Structures**:
- `pthread_*` types (L68-83, L146-148): POSIX thread primitives with opaque storage
- `sem_t` (L64-66): Semaphore with platform-specific sizing

**Signal and Terminal**:
- `sigset_t`, `sigaction` (L174-184): Signal handling structures
- `termios` (L186-194): Terminal I/O control structure

## Architecture-Specific Constants (L256-267)

Internal sizing constants for opaque structures to ensure ABI compatibility:
- `__DEFAULT_RESERVED_SIZE__`: 2-pointer padding for future extensibility (L256)
- Thread object sizes: `__PTHREAD_MUTEX_SIZE__`, `__PTHREAD_COND_SIZE__` etc.
- Network and file descriptor limits: `__SOCKADDR_STORAGE_SIZE__`, `__FDSET_SIZE__`

## System Constants (L276-567)

**Error Codes** (L288-427): Complete errno.h mapping with NuttX-specific error values
**File Operations** (L430-453): fcntl.h constants for file control operations
**Socket Operations** (L486-503): Socket family, type, and option constants
**Signal Numbers** (L520-552): POSIX signal definitions mapped to NuttX values

## Foreign Function Interface (L568-597)

**Core System Calls**:
- `__errno()` (L569): Error number accessor
- `bind()`, `recvfrom()` (L570,573): Network socket operations
- `ioctl()` (L571): Device I/O control with variadic arguments

**Threading Functions**:
- `pthread_create()` (L582): Thread creation with NuttX-specific signature
- `pthread_setname_np/getname_np()` (L592-593): Thread naming extensions

**Time and Random**:
- `clock_gettime()`, `futimens()` (L589-590): High-resolution time operations  
- `getrandom()`, `arc4random*()` (L594-596): Cryptographically secure random number generation

## Design Patterns

**Reserved Space Pattern** (L241-255): Critical architectural decision where structures include `__reserved` fields for forward compatibility. The comment block explains this ensures binary compatibility when NuttX adds fields to POSIX structures.

**Opaque Handle Pattern**: Threading primitives use opaque `__val` arrays sized by platform constants, hiding NuttX-specific implementation details while maintaining ABI stability.

**Conditional Aliasing**: Some constants alias others (e.g., `EWOULDBLOCK = EAGAIN` on L328) to match NuttX's errno semantics.