# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/b64/x86_64/
@generated: 2026-02-09T18:16:09Z

## x86_64 GNU Linux Platform Abstraction Layer

This directory provides comprehensive platform-specific definitions and system bindings for x86_64 GNU Linux systems within the libc crate. It serves as the foundational abstraction layer between Rust code and the underlying GNU/Linux system ABI, supporting both standard 64-bit and x32 (32-bit pointers on x86_64) execution models.

### Architecture and Organization

The module is organized around a common base (`mod.rs`) with architecture-specific variants:

- **`mod.rs`**: Core x86_64 GNU Linux definitions shared across pointer models
- **`not_x32.rs`**: Standard 64-bit x86_64 implementation 
- **`x32.rs`**: x32 ABI variant (32-bit pointers on x86_64)

The module uses conditional compilation to select the appropriate variant based on pointer width, providing a unified interface while maintaining ABI compatibility.

### Key Components

**System Type Definitions**: Platform-specific type aliases (`wchar_t`, `nlink_t`, `blksize_t`, etc.) that map Rust types to their C counterparts, ensuring correct memory layout and calling conventions.

**Core System Structures**: Comprehensive collection of C-compatible structs including:
- Signal handling (`sigaction`, `siginfo_t`, `stack_t`)
- File system operations (`stat`, `statfs`, `flock`, `statvfs`)
- Process/thread context (`user_regs_struct`, `mcontext_t`, `pthread_attr_t`)
- IPC and memory management (`ipc_perm`, `shmid_ds`, `clone_args`)
- x86_64 floating-point state structures

**System Call Interface**: Complete syscall number mappings for both standard x86_64 and x32 ABIs, with architecture-specific offsets and naming conventions.

**Threading Support**: pthread synchronization primitive definitions with correct sizes and initializers for different mutex types (recursive, error-checking, adaptive).

### Public API Surface

**Entry Points**:
- Type definitions for all major system structures (`stat`, `sigaction`, etc.)
- Platform-specific constants (error codes, signal numbers, file flags)
- System call numbers (SYS_* constants)
- pthread initialization constants and size definitions
- External function declarations (`getcontext`, `setcontext`, `sysctl`)

**Key Constants**: Extensive collections of platform-specific values including errno definitions, signal constants, memory mapping flags, terminal control constants, and x86_64 register offsets for debugging.

### Internal Organization and Data Flow

The module follows a layered approach:

1. **Base Layer** (`mod.rs`): Common definitions used across both ABI variants
2. **ABI-Specific Layer** (`not_x32.rs`/`x32.rs`): Variant-specific implementations
3. **Conditional Selection**: Runtime selection of appropriate variant based on target configuration

Data structures maintain C-compatible layout with explicit padding and alignment. Special trait implementations handle comparison and hashing for structures containing arrays or padding fields.

### Important Patterns and Conventions

**ABI Compatibility**: All structures use `#[repr(C)]` to ensure C-compatible memory layout. Fields maintain exact ordering and padding as specified by the GNU C library.

**Conditional Compilation**: Architecture selection uses cfg attributes to include the correct variant without runtime overhead.

**Type Safety**: Rust type system provides memory safety while maintaining zero-cost abstractions over C interfaces.

**Future Compatibility**: Structures include private/reserved fields to maintain ABI stability as the kernel evolves.

This directory serves as the critical bridge between Rust's type system and the low-level GNU/Linux system interface, enabling safe systems programming while preserving performance and ABI compatibility.