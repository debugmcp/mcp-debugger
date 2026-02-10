# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/newlib/horizon/mod.rs
@source-hash: 9ea04f90566fc14f
@generated: 2026-02-09T17:58:20Z

**Purpose:** Platform-specific C bindings for Nintendo 3DS (Horizon OS) using Newlib C library. Provides type definitions, constants, and function declarations for system programming on ARMv6K architecture.

**Dependencies:**
- `crate::off_t`, `crate::prelude::*` (L3-4)
- Various crate-level types (`sa_family_t`, `in_port_t`, etc.)
- Uses `ptr::null_mut()` for RTLD_DEFAULT (L176)

**Type Definitions (L6-21):**
- Basic C type aliases: `wchar_t`, `u_register_t`, `clock_t`, etc.
- Platform-specific sizing for Nintendo 3DS architecture
- Notable: `caddr_t` as mutable char pointer, `sigset_t` as unsigned long

**Key Structures (L22-82):**
- **Network structures:** `hostent` (L23-29), `sockaddr` variants (L31-60) for socket programming
- **Scheduling:** `sched_param` (L62-64) with priority field
- **File system:** `stat` (L66-81) with standard Unix file metadata including timespec timestamps

**Signal Constants (L84-128):**
- Complete POSIX signal definitions (SIGHUP=1 through SIGUSR2=31)
- Signal handling constants (SA_NOCLDSTOP, SIG_BLOCK, etc.)
- Stack size definitions (MINSIGSTKSZ=2048, SIGSTKSZ=8192)

**Socket/Network Constants (L134-174):**
- Socket options and message flags
- Address family constants (AF_UNIX=1, AF_INET6=23)
- Poll event flags and error codes
- EAI (Extended Address Info) error constants

**Process Status Functions (L187-219):**
- Wait status macros implemented as const functions
- **Critical constraint:** All functions return hardcoded values due to Horizon OS limitations
- Always returns: process exited successfully, no signals, no core dumps

**External Functions (L221-276):**
- **pthread operations:** create, scheduling, processor affinity (L222-271)
- **System functions:** `getrandom` (L273), `gethostid` (L275)
- Uses standard C ABI for all external declarations

**Architectural Notes:**
- Designed for Nintendo 3DS homebrew/system development
- Horizon OS has limited process control capabilities (see L186 comment)
- Inherits generic dirent from newlib (L278)