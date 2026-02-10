# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/nto/mod.rs
@source-hash: a5219667280d9664
@generated: 2026-02-09T18:03:28Z

**Primary Purpose**: QNX Neutrino RTOS type definitions and constants for libc bindings

This file provides comprehensive Rust FFI bindings for QNX Neutrino real-time operating system's C library interface. It defines fundamental system types, network structures, threading primitives, and system constants required for low-level system programming on QNX.

**Key Type Categories**:

**Basic System Types** (L3-62): Standard POSIX types like `clock_t`, `sa_family_t`, `dev_t`, `mode_t`, plus QNX-specific types including ELF format definitions (`Elf32_*`, `Elf64_*`) and threading primitives (`pthread_t`, `sem_t`).

**Core System Structures** (L84-676): 
- File system: `stat` (L91-110), `dirent` (L709-715), `dirent_extra` (L85-89)
- Networking: `sockaddr` variants (L122-153), `addrinfo` (L157-166), `msghdr` (L469-477)
- Threading: `pthread_attr_t` (L556-559), scheduler params (L187-198)
- Time/signals: `tm` (L172-184), `siginfo_t` (L292-297), `sigaction` (L299-303)
- Process control: `glob_t` (L314-327), `passwd` (L329-339)

**ELF Format Support** (L352-450): Complete ELF32/64 header, symbol, program header, and section header structures for binary format handling.

**Network Structures** (L112-166): IPv4/IPv6 socket addresses with conditional compilation for different QNX versions (`nto71_iosock` variants).

**Conditional Compilation Patterns** (L1096-1211, L2756-2790): Extensive feature flags distinguishing between QNX versions (`nto70`, `nto71`, `nto71_iosock`) affecting network APIs, syscalls, and structure layouts.

**System Constants** (L1013-2754): 
- Error codes (POSIX errno values L1643-1777)
- File/socket flags and modes
- Signal definitions and process control
- Scheduler and threading constants
- Network protocol definitions

**Function Bindings** (L2792-3334): External C library functions covering:
- Threading (`pthread_*`)
- Process management (`posix_spawn*`, `wait*`)
- File I/O and networking
- Signal handling and timers
- Memory management and system information

**Architecture-Specific Code** (L3394-3403): Conditional inclusion of x86_64 and aarch64 specific definitions.

**Critical Dependencies**: Links against `libsocket` and conditionally `libregex` (L2795-2796). Uses crate prelude and references other crate modules for base types.

**QNX-Specific Extensions**:
- System page access via `_syspage_ptr` (L3329)
- Directory control via `dircntl` (L3276)
- Custom threading exit function `__my_thread_exit` (L3333)
- Message queue and async I/O support

**Invariants**: 
- Maintains binary compatibility with QNX C libraries
- Type sizes and alignment must match system ABI
- Conditional compilation ensures version-appropriate APIs
- Network byte ordering considerations for cross-platform compatibility