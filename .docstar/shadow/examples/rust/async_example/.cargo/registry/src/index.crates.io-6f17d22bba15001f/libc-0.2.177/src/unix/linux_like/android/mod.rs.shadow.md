# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/android/mod.rs
@source-hash: a75260c2c9951ab3
@generated: 2026-02-09T17:58:41Z

This file provides Android-specific Linux system definitions for the libc Rust crate, containing type definitions, constants, and function declarations needed for Android platform compatibility.

**Primary Components:**

**Type Definitions (L6-66):**
- `Ioctl` type with conditional visibility based on doc feature (L6-13)
- Standard POSIX types: `clock_t`, `time_t`, `pthread_*` types (L15-41)
- Kernel types: `__u8`, `__u16`, `__s16`, etc. (L42-46)
- ELF types: `Elf32_*` and `Elf64_*` for 32/64-bit architectures (L50-59)
- Process spawn types as heap-allocated void pointers (L64-65)

**Structure Definitions (L67-500):**
- Core system structures using `s!` macro:
  - `stack_t` for signal stack (L68-72)  
  - `termios` and `termios2` for terminal I/O control (L78-96)
  - `mallinfo` for memory allocation info (L98-109)
  - File locking: `flock`, `flock64` (L111-125)
  - CPU sets and semaphores: `cpu_set_t`, `sem_t` (L127-138)
  - Networking structures: `sockaddr_vm`, netlink headers (L269-276, L191-233)
  - Input system structures for force feedback and events (L348-453)

**Structures Without Extra Traits (L502-630):**
- Uses `s_no_extra_traits!` macro for structures that can't derive standard traits
- Includes directory entries, signal info, network structures, and interface configurations

**Trait Implementations (L632-901):**
- Conditional trait implementations (`PartialEq`, `Eq`, `Hash`) when `extra_traits` feature is enabled
- Custom equality and hashing logic for structures with arrays and padding fields

**Constants (L903-4095):**
- Extensive system constants organized by category:
  - Memory and file system flags (L903-960)
  - Process and signal constants (L1161-1186)
  - Network protocol constants (L1733-1754, L2457-2554)
  - System call constants and error codes (L2836-2871)
  - Netlink and netfilter constants (L1787-2424)
  - Input/output control constants (L1503-1540)

**Function Utilities (L3529-3612):**
- CPU set manipulation functions: `CPU_SET`, `CPU_CLR`, `CPU_ISSET` (L3552-3583)
- Network byte alignment: `NLA_ALIGN` (L3589-3591)
- Device number manipulation: `makedev`, `major`, `minor` (L3598-3611)

**External Function Declarations (L3614-4061):**
- System calls and library functions for:
  - Resource limits: `getrlimit64`, `setrlimit64`, `prlimit` (L3618-3633)
  - Memory management: `mlock2`, `madvise`, `mprotect` (L3637-3640)  
  - Process control: `ptrace`, `clone`, scheduler functions (L3668, L3836-3878)
  - Threading: pthread functions (L3810-3987)
  - File operations: extended attributes, inotify (L3691-3955)
  - Android-specific: property system, arc4random (L3988-4008)

**Architecture-Specific Code (L4063-4073):**
- Conditional compilation for 32-bit vs 64-bit architectures
- Imports platform-specific modules (`b32`, `b64`)

**Signal Info Extensions (L4075-4157):**
- `siginfo_t` implementation with unsafe accessors for union fields
- Methods to extract process ID, status, timing information from signals

**Key Dependencies:**
- Uses `crate::prelude::*` and core libc types
- Imports `cmsghdr`, `msghdr` from parent crate
- Relies on `cfg_if!` for conditional compilation
- Uses custom macros `s!` and `s_no_extra_traits!` for structure definitions

**Architectural Patterns:**
- Extensive use of conditional compilation for Android-specific behavior
- Union field access through unsafe casting and helper structures
- Platform-agnostic constants with Android-specific values
- Comprehensive coverage of Linux syscall interface adapted for Android