# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/haiku/bsd.rs
@source-hash: 4d9af31fdac2561e
@generated: 2026-02-09T18:02:25Z

## Purpose
Provides BSD API compatibility layer for Haiku OS via FFI bindings to system libraries. Contains type definitions, constants, and function bindings that mirror BSD system calls and data structures available in Haiku's compatibility layer.

## Key Structures

### StringList/_stringlist (L14, L19-23)
String list utility structure with dynamic string array management:
- `sl_str`: pointer to array of string pointers
- `sl_max`: maximum capacity
- `sl_cur`: current count
Note: Originally from utility library, kept for backward compatibility

### kevent (L26-34)
BSD kqueue event structure for async I/O event notification:
- `ident`: file descriptor or other identifier
- `filter`: event filter type (read/write/proc)
- `flags`: event flags (add/delete/oneshot/clear)
- `fflags`: filter-specific flags
- `data`: filter-specific data
- `udata`: user-defined data pointer
- `ext`: extension data array

### dl_phdr_info (L37-42)
ELF program header information for dynamic linking:
- `dlpi_addr`: base address of shared object
- `dlpi_name`: object name/path
- `dlpi_phdr`: program header table pointer
- `dlpi_phnum`: number of program headers

## Constants

### Event System (L46-55)
kqueue event filters and flags:
- EVFILT_READ/WRITE/PROC: filter types for different event sources
- EV_ADD/DELETE/ONESHOT/CLEAR: event management flags
- EV_EOF/ERROR: event status indicators
- NOTE_EXIT: process exit notification flag

### I/O Control (L58-62)
ioctl direction and parameter encoding constants for device control operations

## Function Categories

### Process/System Utilities (L67-79)
- `daemon()`: daemonize process
- `getprogname()/setprogname()`: program name management
- `arc4random*()`: cryptographically secure random number generation
- `mkstemps()`: create unique temporary file
- `strtonum()`: safe string-to-number conversion

### Pseudo-Terminal Operations (L82-95)
- `openpty()`: create master/slave pty pair
- `login_tty()`: make fd controlling terminal
- `forkpty()`: fork with new pty

### String Operations (L98-99)
- `strsep()`: tokenize strings (BSD extension)
- `explicit_bzero()`: secure memory clearing

### StringList Management (L103-106)
Dynamic string list operations: init, add, free, find

### Event System (L109-117)
kqueue-based async I/O:
- `kqueue()`: create event queue
- `kevent()`: register/retrieve events

### System Information (L120-125)
- `dl_iterate_phdr()`: iterate over loaded shared objects

### File Operations (L128, L131-142)
- `lutimes()`: set file times (following symlinks)
- `preadv()/pwritev()`: vectored I/O at offset

### Process Management (L145-150)
- `wait4()`: wait for child with resource usage info

## Dependencies
- Links against "bsd" library (L64)
- Imports from crate prelude (L10)
- References core libc types (pid_t, timespec, etc.)

## Architectural Notes
- All functions use C calling convention
- Provides compatibility layer bridging Haiku's native APIs to BSD interfaces
- Maintains backward compatibility for previously exposed utility library functions
- Uses conditional compilation patterns typical of libc crate structure