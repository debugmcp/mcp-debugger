# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b32/arm/
@generated: 2026-02-09T18:16:09Z

## Overall Purpose and Responsibility

This directory provides ARM 32-bit (armv7) specific system interface definitions for Linux GNU libc bindings. It sits at the leaf level of the libc crate's platform hierarchy (`unix/linux_like/linux/gnu/b32/arm/`), delivering the most specific layer of type definitions, constants, and syscall mappings tailored for ARM 32-bit Linux systems running on GNU C Library.

## Key Components and Integration

### Core System Interface Layer
The module defines fundamental system structures that ARM applications interact with:
- **Signal handling**: ARM-specific `sigaction` with `sa_restorer` field and `mcontext_t` containing complete ARM register state (r0-r10, fp, ip, sp, lr, pc, cpsr)
- **File system operations**: Both standard and 64-bit variants of stat, statfs, and flock structures
- **Inter-process communication**: IPC permission structures and shared memory/message queue descriptors with ARM-specific memory layouts

### Architecture-Specific Adaptations
- **Register contexts**: Complete ARM register mapping in `mcontext_t` and `user_regs` preserving ARM calling conventions for signal handling and debugging
- **Memory alignment**: `max_align_t` providing 8-byte alignment requirements for ARM architecture
- **Wide character support**: 32-bit `wchar_t` definition matching ARM's natural word size

### System Call Interface
Comprehensive syscall number mappings (462+ syscalls) from legacy ARM Linux calls through modern additions like io_uring and landlock, enabling direct kernel interface access.

## Public API Surface

### Main Entry Points
- **Type definitions**: Core system structures (`stat64`, `sigaction`, `mcontext_t`, etc.) that applications use for system calls
- **Constants**: File operation flags (`O_DIRECT`, `O_LARGEFILE`), memory mapping flags (`MAP_HUGETLB`, `MAP_SYNC`), and error codes
- **Syscall numbers**: Complete `SYS_*` constant definitions for all supported ARM Linux syscalls

### Conditional Compilation Features
- **`gnu_time_bits64`**: Enables 64-bit time field layouts in system structures
- **`gnu_file_offset_bits64`**: Affects file locking behavior constants
- **`extra_traits`**: Provides additional trait implementations for debugging/testing

## Internal Organization and Data Flow

The module follows a logical progression:
1. **Basic types**: Wide character and fundamental type definitions
2. **System structures**: Signal, file system, and IPC data structures
3. **Constants**: Operational flags and error codes grouped by functional area
4. **Syscall mappings**: Numerical constants for kernel interface

Data flows from high-level Rust code through these type definitions to Linux kernel syscalls, with ARM-specific register layouts preserved for signal handling and debugging contexts.

## Important Patterns and Conventions

### Platform Hierarchy Integration
- Inherits common Unix/Linux definitions from parent modules
- Provides ARM-specific overrides and extensions where the generic implementations don't suffice
- Uses conditional compilation to handle GNU libc version variations

### Safety and Compatibility
- Maintains C ABI compatibility for all structure layouts
- Preserves exact ARM register ordering for kernel compatibility
- Supports both 32-bit and 64-bit file operations on ARM systems

### Systematic Organization
- Groups related constants by functional domain (file ops, memory management, signals)
- Maintains comprehensive syscall coverage with sequential numbering
- Uses consistent naming conventions following Linux kernel patterns