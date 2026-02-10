# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/netbsd/
@generated: 2026-02-09T18:16:18Z

## NetBSD Platform-Specific Architecture Bindings

This directory contains architecture-specific type definitions, constants, and structures for NetBSD operating system support within the libc crate's Unix/BSD compatibility layer. It provides the lowest level of platform abstraction, defining machine-specific details required for proper system interaction across different CPU architectures.

### Overall Purpose

The module serves as the architecture-specific foundation layer for NetBSD system programming in Rust. It bridges the gap between Rust's type system and NetBSD's low-level C ABI, ensuring proper memory layout, alignment, and register access patterns for each supported CPU architecture.

### Supported Architectures

**Complete implementations** for eight major architectures:
- **AArch64** (`aarch64.rs`): 64-bit ARM with comprehensive floating-point and context structures
- **ARM 32-bit** (`arm.rs`): Traditional ARM with both 32-bit and 64-bit register mapping support
- **x86_64** (`x86_64.rs`): 64-bit x86 with full register set and context switching support
- **x86** (`x86.rs`): 32-bit x86 with basic alignment and synchronization primitives
- **MIPS** (`mips.rs`): MIPS architecture with standard ptrace and alignment support
- **PowerPC** (`powerpc.rs`): PowerPC with double-precision alignment requirements
- **RISC-V 64-bit** (`riscv64.rs`): Modern RISC-V with standard calling convention support
- **SPARC64** (`sparc64.rs`): 64-bit SPARC with 16-byte alignment requirements

### Key Components and Organization

**Common Patterns Across Architectures:**
- `__cpu_simple_lock_nv_t`: CPU-specific lock primitive types (varies from `c_uchar` to `c_int`)
- `_ALIGNBYTES`: Memory alignment constants tailored to each architecture's requirements
- **Process Tracing Constants**: `PT_GETREGS`, `PT_SETREGS`, `PT_GETFPREGS`, `PT_SETFPREGS` for debugger support
- **Register Mappings**: Complete enumeration of general-purpose and floating-point registers

**Advanced Architecture Features** (AArch64, x86_64, RISC-V):
- **Context Structures**: `mcontext_t` and `ucontext_t` for signal handling and context switching
- **Register Sets**: Complete floating-point register definitions with union access patterns
- **Floating-Point Support**: Architecture-specific FPU state representation

**Central Coordination** (`mod.rs`):
- Comprehensive NetBSD system interface with 900+ constants and 500+ function declarations
- Signal information structures with safe accessor methods
- ELF binary format support for both 32-bit and 64-bit executables
- Complete socket, file system, and IPC constant definitions
- Foreign function interfaces for libc, librt, and libutil

### Public API Surface

**Primary Entry Points:**
- **Architecture Constants**: Memory alignment, register indices, and CPU-specific values
- **System Structures**: Process context, signal handling, and threading primitives
- **Function Bindings**: Complete NetBSD system call interface through `mod.rs`
- **Type Definitions**: Platform-specific data types ensuring C ABI compatibility

**Usage Pattern:**
```rust
// Architecture auto-selected based on target
use libc::mcontext_t;     // Context switching
use libc::_ALIGNBYTES;    // Memory alignment
use libc::PT_GETREGS;     // Process debugging
```

### Internal Data Flow

1. **Compilation Target Selection**: Rust's `cfg(target_arch)` selects appropriate architecture module
2. **Type Resolution**: Architecture-specific types override generic NetBSD definitions
3. **Constant Propagation**: Platform constants influence memory layout and system call behavior
4. **ABI Compatibility**: Structures use `s!` macro to ensure C memory layout compatibility

### Important Conventions

**Memory Safety**: All low-level structures marked with appropriate `unsafe` boundaries while maintaining Rust type safety at higher levels

**Feature Flags**: Conditional trait implementations (`extra_traits`) for debugging and comparison support when needed

**Version Compatibility**: Link name attributes (e.g., `__gettimeofday50`) handle NetBSD symbol versioning across OS updates

**Defensive Programming**: Extensive constant definitions prevent magic number usage and enable compile-time validation

This directory represents the critical foundation layer that enables safe, efficient NetBSD system programming in Rust across diverse hardware platforms, providing both type safety and performance through architecture-specific optimizations.