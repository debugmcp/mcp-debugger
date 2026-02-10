# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/musl/b32/mips/
@generated: 2026-02-09T18:16:09Z

## Purpose

This directory provides complete platform-specific definitions for 32-bit MIPS architecture running on Linux with musl libc. It serves as a leaf node in the Rust libc crate's hierarchical platform support system, delivering the final layer of MIPS32-specific type definitions, constants, and system call numbers.

## Key Components and Organization

### Core Architecture Support
The module centers around **mod.rs** which provides comprehensive MIPS32/musl-specific definitions including:

- **Type System**: Platform-specific type definitions like `wchar_t` as `c_int`
- **System Structures**: Complete definitions for file system metadata (`stat`, `stat64`, `statfs`), System V IPC primitives (`ipc_perm`, `shmid_ds`, `msqid_ds`), and threading support (`stack_t`)
- **Constants and Flags**: Exhaustive collections of file operation flags, error codes, terminal I/O constants, and signal definitions
- **System Call Interface**: Complete MIPS o32 ABI syscall number definitions (4000+ offset)

### Architecture-Specific Features

**MIPS o32 ABI Compliance:**
- All syscall numbers use the standard MIPS offset of 4000
- Supports both legacy and modern syscalls (io_uring, landlock, futex_waitv)

**musl libc Integration:**
- Conditional compilation handles musl version differences
- Specialized field naming and structure layouts for musl compatibility
- Endianness-aware structure definitions (particularly `msqid_ds`)

**32-bit Optimization:**
- Appropriate sizing for `off_t` and related types
- Memory alignment specifications via `max_align_t`
- Platform-appropriate stack sizes (SIGSTKSZ: 8192, MINSIGSTKSZ: 2048)

## Public API Surface

### Primary Entry Point
- **mod.rs**: Single comprehensive module exporting all platform definitions

### Key Export Categories
- **File System Types**: `stat`, `stat64`, `statfs` structures for file operations
- **IPC Primitives**: System V shared memory and message queue structures
- **System Constants**: Complete errno definitions, file flags, terminal settings
- **System Calls**: Full MIPS o32 syscall number mappings

## Internal Organization

The module follows a systematic organization pattern:
1. **Type Definitions**: Basic type mappings for platform compatibility
2. **Core Structures**: File system and IPC data structures with MIPS-specific layouts
3. **Constants Groups**: Logically grouped constant definitions (signals, file ops, errors)
4. **System Call Table**: Comprehensive syscall number definitions

## Integration Patterns

- **Hierarchical Inheritance**: Imports common types from parent modules (`off_t`, prelude)
- **Conditional Compilation**: Extensive use of cfg attributes for musl version compatibility
- **Systematic Naming**: Consistent padding field conventions and unused field markers
- **Version Awareness**: Deprecated syscall tracking and modern feature support

## Critical Design Considerations

- **ABI Compliance**: Strict adherence to MIPS o32 calling conventions
- **musl Compatibility**: Handles multiple musl libc versions through conditional compilation
- **Endianness Safety**: Architecture-aware structure field ordering
- **Future Extensibility**: Support for modern Linux features while maintaining compatibility