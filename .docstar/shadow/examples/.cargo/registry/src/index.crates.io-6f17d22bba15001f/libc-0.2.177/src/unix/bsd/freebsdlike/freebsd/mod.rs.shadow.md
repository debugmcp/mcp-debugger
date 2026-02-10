# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/freebsd/mod.rs
@source-hash: 69818c7db4f93d1a
@generated: 2026-02-09T18:02:31Z

## FreeBSD-specific System Interface Module

This file provides FreeBSD-specific system interfaces, constants, and bindings for the `libc` crate. It serves as the main entry point for FreeBSD system programming APIs in Rust.

### Key Components

**Type Aliases (L4-54)**
- Core FreeBSD types like `fflags_t`, `vm_prot_t`, `kvaddr_t`, `segsz_t`
- Threading primitives: `lwpid_t`, `pthread_spinlock_t`, `pthread_barrier_t`
- System types: `clockid_t`, `sem_t`, `timer_t`, `mqd_t`
- Audit types: `au_id_t`, `au_asid_t`

**Device Statistics Enums (L56-232)**
- `devstat_support_flags` (L59-70): Device statistics support capabilities
- `devstat_trans_flags` (L75-87): Transaction type flags (read/write/free operations)
- `devstat_tag_type` (L92-103): Command tag types for device operations
- `devstat_match_flags` (L108-119): Device matching criteria
- `devstat_priority` (L124-141): Device priority levels
- `devstat_type_flags` (L146-174): Device type classifications
- `devstat_metric` (L179-232): Performance metrics for device statistics

**System Structures (L250-1418)**

Major structures defined using the `s!` macro:
- `aiocb` (L251-265): Asynchronous I/O control block
- `jail` (L267-276): FreeBSD jail configuration
- `statvfs` (L278-290): File system statistics
- `_sem` (L293-295): Semaphore implementation
- `msqid_ds` (L318-330): Message queue descriptor
- `stack_t` (L332-336): Signal stack
- `mmsghdr` (L338-341): Multiple message header
- `sockcred` (L343-350): Socket credentials
- Various ptrace structures for debugging (L352-394)
- `cpuset_t` (L396-405): CPU set with version-dependent sizing
- `cap_rights_t` (L407-409): Capability rights structure
- Mutex and condition variable structures (L411-427)
- UUID structure (L428-435)
- Threading synchronization primitives (L437-453)
- Network and file system structures (L455-1417)

**Special Unions and Complex Types (L1420-1784)**

Structures defined using `s_no_extra_traits!` macro:
- `utmpx` (L1421-1430): User accounting record
- `sockaddr_dl` (L1445-1454): Data link socket address
- `mq_attr` (L1456-1462): Message queue attributes
- `sigevent` (L1464-1474): Signal event structure
- Network interface structures like `if_data` (L1503-1554) and related unions

**Constants and Flags**

**AIO Constants (L2415-2419)**: Vectored I/O operations
**Capability Constants (L2420-2547)**: Capsicum security framework rights and flags
**Device Statistics (L2549-2551)**: Transaction flags and name length
**CPU Set (L2553-2560)**: CPU set size configuration
**Signal and Event Constants (L2562-2706)**: Signal handling, event notifications, kqueue filters
**System Control (L2710-2924)**: sysctl hierarchy and kernel parameters
**Network Constants (L3125-3593)**: Protocol numbers, socket options, IP/TCP settings
**Process Control (L3067-3124)**: Process tracing, control operations
**File System (L4375-4463)**: Mount flags, VFS operations
**IPC Constants (L3695-3703)**: System V IPC operations

**Function Declarations (L4914-5632)**

External C functions organized by category:
- **AIO functions** (L4920-4932): Asynchronous I/O operations
- **Extended attributes** (L4950-5020): File system extended attribute operations  
- **Jail management** (L5030-5034): FreeBSD jail system calls
- **IPC operations** (L5057-5068): System V IPC functions
- **Process control** (L5070-5072): Process descriptor operations
- **Threading** (L5078-5121): Thread management and synchronization
- **File system** (L5123-5168): File system operations and statistics
- **Memory management** (L5213-5247): jemalloc memory allocator functions
- **Capability system** (L5194-5211): Capsicum capability operations
- **SCTP networking** (L5293-5342): Stream Control Transmission Protocol
- **Event handling** (L5344-5367): Timer and event file descriptors

**Architecture-Specific Modules (L5634-5658)**
Conditionally includes architecture-specific definitions for x86, x86_64, aarch64, ARM, PowerPC, and RISC-V.

**Version-Specific Modules (L5613-5632)**  
Conditionally includes version-specific definitions for FreeBSD 10 through 15.

**Utility Macros and Functions (L4748-4856)**
Helper functions for:
- Message control operations (`CMSG_*`)
- Memory allocator configuration (`MALLOCX_*`) 
- Socket credential sizing (`SOCKCREDSIZE`)
- CPU set manipulation (`CPU_*`)
- Protection flags (`PROT_MAX*`)

This module provides comprehensive FreeBSD system programming capabilities including process management, networking, file systems, security (Capsicum), jails, device statistics, and low-level system interfaces.