# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/solarish/illumos.rs
@source-hash: c6305f2555bc542d
@generated: 2026-02-09T18:03:24Z

## Purpose
Illumos-specific system bindings for the libc crate, providing OS-specific structs, constants, and function declarations for the Illumos operating system (Solaris derivative).

## Key Structures

### Core System Structures
- **aiocb** (L11-22): Asynchronous I/O control block with file descriptor, buffer pointer, operation parameters, and result tracking
- **shmid_ds** (L24-37): System V shared memory segment descriptor with permissions, size, process IDs, and timestamps
- **fil_info** (L39-43): File information structure for socket filter operations

### Specialized Structures  
- **epoll_event** (L48-51): Event polling structure with packed representation for x86/x86_64, includes events mask and 64-bit data
- **utmpx** (L53-65): Extended user accounting structure for login records with user info, terminal data, timestamps, and host information

## Trait Implementations
- **Conditional trait implementations** (L68-123): PartialEq, Eq, and Hash traits for utmpx and epoll_event when "extra_traits" feature is enabled
- Custom equality comparison for utmpx handles all fields including array comparisons (L70-88)

## Constants Categories

### UTMP Configuration (L125-129)
Size constants for utmpx structure fields (_UTX_USERSIZE, _UTX_LINESIZE, etc.)

### Network & File Operations (L131-169)
- Address family constants (AF_LOCAL, AF_FILE)
- Event file descriptor flags (EFD_*)
- TCP keep-alive options (TCP_KEEPIDLE, TCP_KEEPCNT, etc.)
- File control operations (F_OFD_*, F_FLOCK*, F_DUPFD_*)
- Socket filter constants (FIL_*, SOL_FILTER)

### Memory & Process Management (L171-244)
- Memory advice constants (POSIX_FADV_*, MADV_PURGE)
- Process binding (PBIND_HARD, PBIND_SOFT)
- Processor group resource types (LGRP_RSRC_*)
- Privilege flags composition (PRIV_USER)

### Epoll Event System (L213-231)
Complete epoll constants for event types (EPOLLIN, EPOLLOUT, etc.) and control operations

### Hardware & Terminal (L246-265)
- Auxiliary vector constants (AT_SUN_*)
- High-speed baud rates (B1000000 through B4000000)
- Timer file descriptor flags (TFD_*)

## Function Declarations

### Event & I/O Operations (L267-285)
- eventfd(): Create event file descriptor
- epoll_*(): Complete epoll interface (create, wait, control)

### System & Process Management (L287-325)
- mincore(): Memory residency checking
- pset_*(): Processor set operations
- pthread_attr_*(): Thread attribute management
- posix_fadvise(): File access pattern advice

### File & String Operations (L313-342)
- preadv/pwritev(): Vectored I/O with offset
- posix_spawn_file_actions_addfchdir_np(): Non-portable spawn file action
- strcasecmp_l/strncasecmp_l(): Locale-aware string comparison
- timerfd_*(): Timer file descriptor operations

## Dependencies
Imports from parent crate modules for common types (off_t, exit_status) and privilege constants (NET_MAC_AWARE, PRIV_*). Uses crate::prelude for standard type aliases.

## Architecture Notes
- Conditional packing for epoll_event on x86 architectures
- 64-bit optimized constants with note about potential 32-bit adjustments
- Illumos-specific extensions to POSIX APIs