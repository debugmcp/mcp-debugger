# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/uclibc/mips/mips32/
@generated: 2026-02-09T18:16:12Z

## MIPS32 uClibc Linux Platform Integration Module

This directory provides complete low-level platform-specific bindings for MIPS32 architecture running Linux with uClibc, serving as a foundational layer for Rust's libc crate FFI interface to POSIX and Linux system APIs.

### Overall Purpose and Responsibility

The module acts as a comprehensive platform abstraction layer that bridges Rust code with the MIPS32/Linux/uClibc ABI, providing:
- Native type definitions matching C library expectations
- Memory-layout-accurate structure definitions for kernel/userspace interfaces  
- Complete system call number mappings for the MIPS o32 ABI
- FFI bindings for essential system library functions

### Key Components and Integration

**Type System Foundation**
- Fundamental C type aliases (`time_t`, `off_t`, `ino_t`, etc.) sized appropriately for MIPS32
- Mixed 32/64-bit type support enabling both legacy and modern file operations
- Architecture-specific unsigned long types following MIPS conventions

**Core Structure Definitions**  
The module provides memory-layout-precise definitions for critical system interfaces:
- **File System Interface**: `stat`/`stat64`, `statfs`/`statfs64`, `statvfs64` structures
- **Process/Threading**: `pthread_attr_t`, `sigaction`, `sigset_t`, `siginfo_t`
- **IPC Mechanisms**: `ipc_perm`, `shmid_ds`, `msqid_ds` with MIPS endianness handling
- **Networking**: `msghdr`, `cmsghdr` for socket communication
- **System Resources**: `sysinfo`, `flock`, `termios`, `sem_t`

**System Call Interface**
Complete mapping of Linux system calls using MIPS o32 ABI numbering (base 4000), covering:
- Core operations (file I/O, memory management, process control)  
- Signal handling (both classic and real-time signals)
- Modern kernel features (io_uring, landlock, futex variants)
- Architecture-specific call numbers ensuring proper kernel interface

### Public API Surface

**Primary Entry Points:**
- **Type Definitions**: All fundamental C types for cross-language compatibility
- **Structure Definitions**: ABI-compatible layouts for kernel/userspace data exchange
- **System Call Constants**: `SYS_*` constants for direct syscall invocation
- **FFI Function Bindings**: Direct access to libutil functions (`sysctl`, `glob64`, pthread affinity)

**Threading Constants**: Architecture-specific sizing for pthread objects (mutexes, conditions, barriers)

### Internal Organization and Data Flow

The module follows a layered organization:
1. **Type Layer**: Basic type aliases establishing size/alignment contracts
2. **Structure Layer**: Complex data structures with proper padding and field ordering
3. **Constant Layer**: System call numbers and threading object sizes  
4. **FFI Layer**: External function declarations for runtime library integration

Data flows from Rust application code through these bindings to:
- Kernel system calls via numbered constants
- C library functions via FFI declarations  
- Kernel data structures via memory-mapped layouts

### Important Patterns and Conventions

**MIPS32 Specific Adaptations:**
- Big-endian conditional compilation for structure layouts (e.g., `msqid_ds`)
- MIPS o32 ABI system call numbering convention (4000 + syscall_number)
- 32-bit base types with explicit 64-bit variants for file operations
- Architecture-appropriate padding and alignment in all structures

**Dual API Support:** The module maintains both 32-bit legacy interfaces and 64-bit extended versions (stat/stat64, statfs/statfs64) enabling applications to choose appropriate APIs based on requirements.

This module serves as the definitive platform interface for any Rust code requiring direct system interaction on MIPS32/Linux/uClibc platforms, ensuring ABI compatibility and providing comprehensive access to underlying system capabilities.