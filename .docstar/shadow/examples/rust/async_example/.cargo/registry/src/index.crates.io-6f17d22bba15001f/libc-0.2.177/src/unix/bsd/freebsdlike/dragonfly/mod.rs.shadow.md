# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/freebsdlike/dragonfly/mod.rs
@source-hash: dc6daf4a8e04ad50
@generated: 2026-02-09T17:57:31Z

## DragonFly BSD System Definitions

This file provides low-level system type definitions, structures, constants, and external function bindings specifically for DragonFly BSD, a Unix-like operating system derived from FreeBSD. It serves as the platform-specific layer in the Rust `libc` crate.

### Core Type Definitions (L4-46)

Defines fundamental system types that map C types to Rust equivalents:
- Basic types: `dev_t`, `wchar_t`, `clock_t`, `ino_t`, `lwpid_t` (L4-11)
- Time types: `time_t`, `suseconds_t` (L13-14)
- Memory/VM types: `segsz_t`, `vm_prot_t`, `vm_maptype_t`, `vm_inherit_t` (L35-42)
- Threading types: `pthread_spinlock_t`, `pthread_barrier_t` (L32-33)
- VM map pointers: `vm_map_t`, `vm_map_entry_t` (L43-44)

### Enumerations (L57-73)

Two key enums defined via macro `e!`:
- `lwpstat`: Lightweight process states (LSRUN, LSSTOP, LSSLEEP) (L59-63)
- `procstat`: Process states (SIDL, SACTIVE, SSTOP, SZOMB, SCORE) (L66-72)

### Core System Structures (L75-414)

Major structures defined via macro `s!`:

**Event/IO Structures:**
- `kevent`: Kernel event structure for kqueue (L76-83)
- `aiocb`: Asynchronous I/O control block (L90-100)
- `sigevent`: Signal event notification (L475-486)

**File System Structures:**
- `stat`: File status information with DragonFly-specific fields (L140-163)
- `statvfs`: File system statistics (L118-138)

**Process/Thread Information:**
- `kinfo_proc`: Comprehensive process information structure (L300-348)
- `kinfo_lwp`: Lightweight process information (L272-298)
- `kinfo_file`: File descriptor information (L245-257)

**Memory Management:**
- `vmspace`: Virtual memory space description (L373-392)
- `vm_map_entry`: VM map entry with protection/inheritance flags (L354-363)

**Networking:**
- `sockaddr_dl`: Data link socket address (L202-213)
- `if_data` and `if_msghdr`: Network interface data/messages (L165-200)

### Structures Without Standard Traits (L416-534)

Special structures defined via `s_no_extra_traits!` that require custom trait implementations:
- `utmpx`: User accounting record (L417-432)
- `dirent`: Directory entry (L441-448)  
- `statfs`: File system status (L450-473)
- `mcontext_t`: Machine context for signal handling (L488-521)
- `ucontext_t`: User context including signal masks (L525-533)

### Custom Trait Implementations (L536-783)

Conditional implementations of `PartialEq`, `Eq`, and `Hash` for structures that can't auto-derive these traits due to arrays, function pointers, or padding fields.

### Constants (L785-1498)

Extensive constant definitions organized by subsystem:

**System Limits:** `RAND_MAX`, `PTHREAD_STACK_MIN`, `SIGSTKSZ` (L785-787)
**File Operations:** `O_CLOEXEC`, `F_GETLK`, `F_SETLK` (L794-799)
**System Control:** `CTL_*` constants for sysctl interface (L812-942)
**Network Protocols:** Complete IPPROTO_* definitions (L1050-1268)
**kqueue Events:** `EVFILT_*` and `EV_*` constants (L954-978)
**Interface Flags:** `IFF_*` network interface flags (L1020-1043)

### Utility Functions (L1428-1498)

**Message Control Functions:**
- `CMSG_DATA`, `CMSG_LEN`, `CMSG_NXTHDR`, `CMSG_SPACE`: Socket message control manipulation (L1429-1451)

**CPU Set Operations:**
- `CPU_ZERO`, `CPU_SET`, `CPU_CLR`, `CPU_ISSET`: CPU affinity mask operations (L1453-1474)

**Status/Device Utilities:**
- `WIFSIGNALED`: Process termination signal check (L1478-1480)
- `makedev`, `major`, `minor`: Device number manipulation (L1482-1497)

### External Function Bindings (L1500-1635)

**Standard Library Functions:**
- Basic system calls: `mprotect`, `uname` (L1503, L1534)
- Process control: `waitid`, `procctl` (L1516-1521, L1560-1565)
- Threading: `pthread_spin_*` family (L1541-1545)
- Scheduling: `sched_getaffinity`, `sched_setaffinity` (L1547-1552)

**DragonFly-Specific Functions:**
- Checkpoint system: `sys_checkpoint` (L1574)
- User mutex: `umtx_sleep`, `umtx_wakeup` (L1576-1577)
- Utility: `setproctitle`, `closefrom` (L1554, L1588)

**Linked Libraries:**
- Real-time library (`-lrt`): AIO functions (L1592-1613)
- KVM library (`-lkvm`): Kernel memory access (L1616-1627)

### Dependencies

- Imports from parent modules: `prelude`, `cmsghdr`, `off_t` (L1-2)
- Conditional errno module inclusion based on thread-local storage support (L1630-1635)

This file represents the complete system interface layer for DragonFly BSD, enabling Rust programs to interact with all major kernel subsystems through safe type definitions and function bindings.