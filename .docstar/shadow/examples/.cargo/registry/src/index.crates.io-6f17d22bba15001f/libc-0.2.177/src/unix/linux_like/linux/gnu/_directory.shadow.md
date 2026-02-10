# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/linux_like/linux/gnu/
@generated: 2026-02-09T18:17:14Z

## GNU/Linux Platform Abstraction Layer

This directory serves as the complete GNU/Linux platform abstraction layer within the libc crate's Unix hierarchy, providing comprehensive bindings for GNU C Library (glibc) systems on Linux. It acts as the critical bridge between Rust applications and the underlying GNU/Linux kernel ABI, offering both architecture-agnostic definitions and architecture-specific specializations.

### Overall Architecture and Responsibility

The directory implements a three-tier architecture that provides complete GNU/Linux system interface coverage:

1. **Common GNU Layer** (`mod.rs`): Core glibc-specific types, structures, and constants shared across all architectures
2. **Architecture Bit-Width Layer** (`b32/`, `b64/`): Platform definitions organized by processor word size
3. **Architecture-Specific Layer**: Individual CPU architecture implementations with precise ABI compatibility

This hierarchical approach enables the libc crate to provide unified Rust interfaces while maintaining exact binary compatibility with GNU C Library across diverse hardware platforms.

### Key Components Integration

#### Core GNU Definitions (`mod.rs`)
Provides the foundational GNU/Linux interface layer including:
- **System Types**: Fundamental glibc types (`pthread_t`, `regoff_t`, `__kernel_rwf_t`)
- **Major Structures**: Process I/O (`aiocb`, `iocb`), networking (`msghdr`, `rtentry`), file systems (`glob64_t`, `fpos_t`), and memory management (`mallinfo`, `sem_t`)
- **Signal Interface**: Complete `siginfo_t` implementation with unsafe accessor methods for union field access
- **Constants Repository**: Comprehensive GNU/Linux constants including huge page flags, system limits, network protocols, and POSIX extensions
- **External Functions**: GNU-specific function declarations for enhanced system calls, memory management, and process spawning

#### Architecture Bit-Width Layers
- **32-bit Layer (`b32/`)**: Complete 32-bit GNU libc bindings supporting eight architectures (x86, ARM, MIPS, PowerPC, SPARC, RISC-V, C-Sky, M68K) with conditional 64-bit time/file offset support
- **64-bit Layer (`b64/`)**: Comprehensive 64-bit implementations across eight architectures (x86_64, AArch64, SPARC64, MIPS64, PowerPC64, RISC-V64, LoongArch64, S390x) with multi-ABI support

#### Conditional Compilation Framework
Sophisticated feature-driven compilation system that enables:
- Automatic architecture selection based on target triple
- GNU-specific feature toggles (`gnu_time_bits64`, `gnu_file_offset_bits64`)
- Documentation vs. production build variations
- ABI variant selection (LP64/ILP32, standard/x32)

### Public API Surface

#### Primary Entry Points
- **Type System**: Complete C-compatible type aliases and structure definitions for all supported GNU/Linux architectures
- **System Call Interface**: Exhaustive syscall number mappings (SYS_* constants) with architecture-specific implementations
- **Constants Library**: Comprehensive platform constants for file operations, networking, process control, memory management, and GNU extensions
- **Structure Definitions**: Binary-compatible layouts for all major system interfaces including files, processes, signals, networking, and IPC

#### Core Interface Categories
- **File System Operations**: `stat`, `statfs`, `glob`, and related structures with 32/64-bit variants
- **Process and Signal Management**: `sigaction`, `siginfo_t`, `pthread_attr_t`, and process debugging interfaces
- **Network and Communication**: Socket structures, netlink interfaces, and protocol family constants
- **Memory Management**: Memory allocation statistics, semaphores, and shared memory interfaces
- **System Configuration**: POSIX configuration constants, system limits, and capability definitions

### Internal Organization and Data Flow

#### Hierarchical Specialization Pattern
The directory implements progressive specialization:
1. **GNU Base Layer**: Shared glibc-specific definitions and GNU extensions
2. **Bit-Width Adaptation**: Architecture word-size specific implementations
3. **CPU Architecture**: Platform-specific register layouts, syscall numbering, and hardware features

#### Feature-Driven Adaptation
Extensive conditional compilation enables:
- **Time Representation**: Seamless transition between 32-bit and 64-bit time types
- **File System Support**: Large file support through compile-time feature selection  
- **Architecture Selection**: Automatic inclusion of appropriate platform modules
- **ABI Compatibility**: Multiple execution models within single architectures

#### Safety and Compatibility Framework
All definitions maintain strict safety guarantees through:
- **C ABI Compatibility**: Exact structure layouts with proper padding and alignment
- **Memory Safety**: Careful handling of union types and unsafe function pointers
- **Type Safety**: Architecture-appropriate primitive type mappings
- **Future Compatibility**: Reserved fields and extensible constant definitions

### Integration Patterns and Conventions

#### Macro-Driven Structure Definitions
Consistent use of `s!` and `s_no_extra_traits!` macros ensures uniform structure layout and trait derivation across all architectures while handling edge cases like padding fields and deprecated members.

#### Cross-Platform Consistency
Despite architectural diversity, the directory maintains consistent interface patterns that enable portable system programming while preserving access to platform-specific optimizations and features.

#### Comprehensive Coverage Philosophy
Every major GNU/Linux system interface is represented, from basic POSIX functionality to advanced GNU extensions, modern kernel features (io_uring, landlock), and architecture-specific hardware capabilities.

This directory represents the most complete and sophisticated GNU/Linux platform abstraction available in the Rust ecosystem, enabling zero-cost, type-safe access to the full spectrum of GNU/Linux system interfaces across all major CPU architectures while maintaining perfect binary compatibility with existing C code and system libraries.