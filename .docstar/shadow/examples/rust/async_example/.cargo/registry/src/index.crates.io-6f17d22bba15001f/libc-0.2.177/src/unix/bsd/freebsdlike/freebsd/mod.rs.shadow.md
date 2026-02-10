# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/mod.rs
@source-hash: 69818c7db4f93d1a
@generated: 2026-02-09T17:57:29Z

## Purpose
FreeBSD-specific definitions and bindings for the libc crate. This module provides comprehensive FreeBSD system call interfaces, data structures, and constants that extend the base Unix functionality for FreeBSD systems.

## Key Components

### Type Definitions (L4-54)
- Basic FreeBSD types: `fflags_t`, `vm_prot_t`, `kvaddr_t`, `segsz_t` etc.
- Process and thread types: `lwpid_t`, `clockid_t`, `timer_t`, `sem_t`
- Filesystem types: `fsblkcnt_t`, `fsfilcnt_t`, `idtype_t`
- Network types: `msglen_t`, `msgqnum_t`, `mqd_t`
- CPU and threading types: `cpulevel_t`, `cpuwhich_t`, `cpusetid_t`

### Device Statistics Enums (L56-232)
- `devstat_support_flags` (L59-64): Device statistics support capabilities
- `devstat_trans_flags` (L75-80): Transaction types (READ, WRITE, FREE)
- `devstat_tag_type` (L92-97): Command tagging types
- `devstat_match_flags` (L108-113): Device matching criteria
- `devstat_priority` (L124-135): Device priority levels
- `devstat_type_flags` (L146-168): Device interface and type classifications
- `devstat_metric` (L179-226): Statistics metrics for device performance

### Core Data Structures (L250-1418)

#### System Structures
- `aiocb` (L251-265): Asynchronous I/O control block
- `jail` (L267-276): FreeBSD jail configuration
- `statvfs` (L278-290): Filesystem statistics
- `_sem` (L293-295): Internal semaphore structure
- `cpuset_t` (L396-405): CPU affinity set (size varies by FreeBSD version)

#### Process and Thread Management
- `ptrace_vm_entry` (L352-363): Process virtual memory mapping info
- `ptrace_lwpinfo` (L365-376): Lightweight process debugging info
- `ptrace_sc_ret` (L378-381): System call return values for ptrace

#### Memory and Synchronization
- `umutex` (L411-419): Userland mutex
- `ucond` (L421-426): Userland condition variable
- `cap_rights_t` (L407-409): Capability rights descriptor

#### System Information
- `kinfo_vmentry` (L455-489): Kernel virtual memory entry info
- `filestat` (L495-507): File descriptor statistics
- `procstat` (L514-522): Process statistics handle

#### Network Structures (L1421-1784)
- `utmpx` (L1421-1430): Extended user accounting
- `sockaddr_dl` (L1445-1454): Data link socket address
- `mq_attr` (L1456-1462): Message queue attributes
- `sigevent` (L1464-1474): Signal event notification

### Constants and Flags

#### AIO Constants (L2415-2418)
- `LIO_VECTORED`, `LIO_WRITEV`, `LIO_READV`: Vectored I/O operations

#### Capability Rights (L2420-2544)
- Comprehensive set of `CAP_*` constants for FreeBSD capabilities system
- File operation rights: `CAP_READ`, `CAP_WRITE`, `CAP_SEEK`
- Network rights: `CAP_ACCEPT`, `CAP_BIND`, `CAP_CONNECT`
- Extended attributes: `CAP_EXTATTR_*`, `CAP_ACL_*`

#### System Control (L2716-2924)
- `CTL_*` constants for sysctl hierarchy navigation
- `KERN_*`, `HW_*`, `USER_*` constants for system information queries

#### Process and Signal Management (L3010-3124)
- `PT_*` constants for ptrace operations
- `PTRACE_*` flags for process tracing
- `PROC_*` constants for process control operations

#### Network Protocol Constants (L3355-3593)
- Comprehensive `IPPROTO_*` definitions for IP protocols
- TCP socket options: `TCP_MD5SIG`, `TCP_INFO`, `TCP_CONGESTION`
- SCTP protocol constants and socket options

### Function Declarations

#### Core System Functions (L4915-5373)
- AIO functions: `aio_cancel`, `aio_error`, `aio_read`, `aio_write` etc.
- Extended attributes: `extattr_get_*`, `extattr_set_*`, `extattr_delete_*`
- Jail management: `jail`, `jail_attach`, `jail_remove`
- Process control: `waitid`, `procctl`, `pdfork`, `pdgetpid`
- Capability system: `cap_enter`, `cap_getmode`, `cap_rights_*`

#### Specialized Libraries

##### Memory Statistics (L5375-5389)
- `memstat_*` functions for kernel memory statistics via libmemstat

##### KVM Library (L5391-5432)
- `kvm_*` functions for kernel virtual memory access and process inspection

##### Utility Library (L5434-5476)
- Extended attributes, hostname resolution, kernel module loading
- Process information: `kinfo_getvmmap`, file locking: `flopen`

##### Process Statistics (L5478-5568)
- `procstat_*` functions for detailed process and system information

##### Real-time Library (L5570-5582)
- POSIX timer functions: `timer_create`, `timer_settime`, etc.

##### Device Statistics (L5584-5611)
- `devstat_*` functions for system device performance monitoring

### Architecture Support (L5634-5659)
Conditional compilation for different FreeBSD versions (10-15) and CPU architectures (x86, x86_64, aarch64, arm, powerpc, powerpc64, riscv64).

## Dependencies
- Imports from `crate::prelude::*` and `crate::{cmsghdr, off_t}` (L1-2)
- Links to external libraries: memstat, kvm, util, procstat, rt, devstat

## Notable Patterns
- Extensive use of conditional compilation (`cfg_if!`) for version and architecture differences
- Consistent naming conventions following FreeBSD system interfaces
- Comprehensive constant definitions matching FreeBSD header files
- Type safety through distinct type aliases for different system concepts