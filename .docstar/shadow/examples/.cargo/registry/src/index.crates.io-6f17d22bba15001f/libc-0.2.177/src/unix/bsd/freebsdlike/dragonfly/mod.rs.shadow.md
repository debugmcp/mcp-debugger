# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/dragonfly/mod.rs
@source-hash: dc6daf4a8e04ad50
@generated: 2026-02-09T18:02:32Z

**DragonFlyBSD System Type and Function Definitions**

This file defines platform-specific types, structures, constants, and function declarations for DragonFlyBSD, a Unix-like operating system. It serves as a low-level interface layer for system programming, providing C-compatible bindings for kernel data structures and system calls.

## Core Type Definitions (L4-42)
Fundamental system types including:
- Device and file system types: `dev_t`, `ino_t`, `fsblkcnt_t`, `fsfilcnt_t` (L4, L7, L18-19)
- Time-related types: `time_t`, `suseconds_t`, `clock_t`, `clockid_t` (L6, L11, L13-14)
- Process/thread types: `lwpid_t`, `pid_t` (L8)
- Virtual memory types: `vm_prot_t`, `vm_maptype_t`, `vm_inherit_t`, `vm_eflags_t` (L37-41)
- CPU set types: `cpuset_t`, `cpu_set_t` aliased to `cpumask_t` (L26-27)

## Process/Thread State Enums (L57-73)
- `lwpstat` enum: Lightweight process states (LSRUN, LSSTOP, LSSLEEP)
- `procstat` enum: Process states (SIDL, SACTIVE, SSTOP, SZOMB, SCORE)

## Key Data Structures

### System Information Structures
- `kevent`: Kernel event structure for kqueue mechanism (L76-83)
- `stat`: File status structure with DragonFly-specific layout (L140-163)
- `statvfs`: File system statistics (L118-138)
- `statfs`: Alternative file system info structure (L450-473)

### Process/Thread Information
- `kinfo_proc`: Comprehensive process information structure (L300-348)
- `kinfo_lwp`: Lightweight process (thread) information (L272-298)
- `kinfo_file`: File descriptor information (L245-257)

### Network and IPC Structures
- `sockaddr_dl`: Data link socket address (L202-213)
- `if_data`: Network interface statistics (L165-190)
- `if_msghdr`: Interface message header (L192-200)
- `shmid_ds`: Shared memory segment descriptor (L233-243)

### Virtual Memory Structures
- `vmspace`: Virtual memory space descriptor (L373-392)
- `vm_map_entry`: Virtual memory mapping entry (L354-363)
- `__c_anonymous_vm_map` and `__c_anonymous_pmap`: Opaque VM structures (L350-371)

### Signal and Context Structures
- `mcontext_t`: Machine context for signal handling (L488-521)
- `ucontext_t`: User context structure (L525-533)
- `sigevent`: Signal event structure for async I/O (L475-486)

## System Constants (L785-1498)
Extensive constant definitions for:
- Signal handling: `SIGCKPT`, `SIGCKPTEXIT` (L788-789)
- File operations: `O_CLOEXEC`, `O_DIRECTORY`, `F_GETLK` series (L794-799)
- Network protocols: Complete IP protocol definitions (L1051-1268)
- System control: `CTL_*` and `KERN_*` sysctl constants (L812-942)
- Process control: `PROC_*` constants (L1013-1017)

## CPU Set Manipulation Functions (L453-474)
Functions for CPU affinity management:
- `CPU_ZERO`, `CPU_SET`, `CPU_CLR`, `CPU_ISSET` - CPU set operations

## Device Number Functions (L482-497)
Helper functions for device number manipulation:
- `makedev`, `major`, `minor` - Device number creation and extraction

## External Function Declarations (L1500-1612)
System call and library function prototypes including:
- Process control: `waitid`, `procctl` (L1516-1565)
- Memory management: `mprotect`, shared memory functions (L1503, L1556-1559)
- File system: `statfs`, `fstatfs` (L1532-1533)
- Threading: pthread spinlock functions (L1541-1545)
- CPU affinity: `sched_getaffinity`, `sched_setaffinity` (L1547-1552)
- AIO operations: Asynchronous I/O functions (L1593-1609)

## Conditional Trait Implementations (L536-782)
When `extra_traits` feature is enabled, provides `PartialEq`, `Eq`, and `Hash` implementations for structures that don't automatically derive these traits due to array fields or function pointers.

This file is essential for low-level system programming on DragonFlyBSD, providing the necessary interface between Rust code and the operating system kernel.