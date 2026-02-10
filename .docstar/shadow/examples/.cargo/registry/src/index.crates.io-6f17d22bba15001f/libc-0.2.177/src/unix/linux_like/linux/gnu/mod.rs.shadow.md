# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/mod.rs
@source-hash: 606d323e8aa2c14b
@generated: 2026-02-09T18:02:43Z

## GNU/Linux System Type Definitions and Constants

This file provides comprehensive GNU C Library (glibc) bindings for Linux systems, containing type aliases, struct definitions, constants, and external function declarations specific to GNU/Linux environments.

### Core Type Aliases (L4-9)
- `pthread_t` - Thread identifier type (c_ulong)
- `__priority_which_t`, `__rlimit_resource_t` - System resource management types
- `Lmid_t` - Link map identifier for dynamic loading
- `regoff_t` - Regular expression offset type
- `__kernel_rwf_t` - Kernel read/write flags type

### Conditional Ioctl Type (L11-19)
The `Ioctl` type is conditionally exported as `pub(crate)` for documentation builds or `#[doc(hidden)] pub` for regular builds, used internally by `linux::arch` modules.

### Major Struct Definitions

#### System I/O Structures
- `aiocb` (L22-42): Asynchronous I/O control block with file descriptor, buffer, and callback information
- `iocb` (L263-282): Kernel AIO control block with endian-specific field ordering
- `msghdr` (L67-75): Socket message header for sendmsg/recvmsg operations
- `cmsghdr` (L77-81): Control message header for ancillary data

#### Process and Signal Management
- `__exit_status` (L44-47): Process exit status structure
- `siginfo_t` implementation methods (L376-458): Unsafe accessors for signal information fields including `si_addr()`, `si_value()`, `si_pid()`, etc.
- Internal signal field access structures (L403-432): `sifields_sigchld`, `sifields`, `siginfo_f` for union field casting

#### Network and Communication
- `nl_pktinfo` (L136-138): Netlink packet information
- `nl_mmap_req` (L140-145): Netlink memory mapping request parameters
- `rtentry` (L156-175): Network routing table entry with architecture-specific padding
- `tcp_info` (L286-320): Comprehensive TCP socket state information

#### File System and Storage
- `glob64_t` (L54-65): 64-bit file globbing result structure
- `fpos_t`/`fpos64_t` (L348-360): File position structures with conditional 64-bit support
- `regex_t` (L188-197): Regular expression compiled pattern structure

#### Memory Management
- `mallinfo`/`mallinfo2` (L110-134): Memory allocation statistics (int vs size_t variants)
- `sem_t` (L333-341): Semaphore type with architecture-specific alignment and sizing

#### Time and Synchronization
- `timespec` (L363-373): Time specification with GNU time64 and x32 compatibility handling
- `ntptimeval` (L177-186): NTP time value structure
- `__timeval` (L49-52): Internal timeval structure

#### Process Tracing and Debugging
- `ptrace_*` structures (L225-261): Process tracing syscall information with anonymous unions
- ELF compression headers: `Elf64_Chdr` (L199-204), `Elf32_Chdr` (L206-210)

#### Terminal I/O
- `termios` (L83-108): Terminal I/O settings with architecture-conditional speed fields

### Union Types (L460-465)
- `__c_anonymous_ptrace_syscall_info_data`: Anonymous union for ptrace syscall data variants

### Complex Structures with Conditional Compilation
- `utmpx` (L467-509): User accounting structure with extensive architecture-specific field variations
- Conditional trait implementations for `PartialEq`, `Eq`, `Hash` when "extra_traits" feature is enabled (L512-574)

### Constants and Enumerations

#### Huge Page Support (L577-615)
Complete set of `HUGETLB_FLAG_ENCODE_*` and corresponding `MAP_HUGE_*` constants for various memory page sizes (64KB to 16GB).

#### System Limits and Configuration (L617-687)
- Process priority constants (`PRIO_*`)
- User accounting constants (`__UT_*`, `EMPTY`, `RUN_LVL`, etc.)
- Locale category extensions (`LC_PAPER`, `LC_NAME`, etc.)

#### Network Protocol Constants (L654-705)
Socket options, address families (AF_*), and protocol families (PF_*) including newer protocols like VSOCK and XDP.

#### POSIX and GNU Extensions (L709-1042)
- Buffer sizes (`BUFSIZ`, `TMP_MAX`, `FOPEN_MAX`)
- System configuration constants (`_SC_*` series)
- Threading constants including architecture-specific `PTHREAD_STACK_MIN`
- File system magic numbers with architecture-conditional types
- Process tracing constants (`PTRACE_*`)

#### Advanced System Features (L844-1025)
- Netlink routing constants
- Kernel capabilities and key management
- Memory management parameters
- Time adjustment constants (ADJ_*, STA_*, MOD_*)
- File globbing extensions

### External Function Declarations (L1051-1350)
Comprehensive extern "C" block with:
- Shadow password functions (`fgetspent_r`, `sgetspent_r`, etc.)
- Enhanced system calls (`sendmmsg`, `recvmmsg` with time64 support)
- Resource limit management (`getrlimit64`, `setrlimit64`, `prlimit64`)
- User/group database access with reentrant variants
- Memory management (`mallopt`, `malloc_*` family)
- Process spawning extensions (POSIX spawn with glibc additions)
- File system operations (`renameat2`, `execveat`)
- GNU-specific extensions (`gnu_get_libc_version`, `explicit_bzero`)

### Architecture-Specific Module Inclusion (L1352-1382)
Conditional compilation logic that includes either 32-bit (`b32`) or 64-bit (`b64`) specific definitions based on target architecture, supporting all major Linux architectures including ARM, x86, MIPS, PowerPC, SPARC, RISC-V, and LoongArch.