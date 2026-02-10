# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/haiku/native.rs
@source-hash: 8248c0491d62ed96
@generated: 2026-02-09T18:02:46Z

## Purpose
Native Haiku OS API bindings for Rust's libc crate, providing complete system-level types, constants, and functions specific to the Haiku operating system (R1 beta 5). Organized by Haiku C/C++ header file structure while adhering to Rust libc conventions.

## Key Components

### Macro Utilities
- `haiku_constant!` (L12-16): Converts multi-character constants (like 'UPDA', 'MSGM') into u32 values using bit-shifting operations, following Haiku's non-standard constant representation

### Type Definitions
**Core Types** (L19-36):
- `status_t`, `bigtime_t`, `nanotime_t`, `type_code`, `perform_code` - fundamental Haiku types
- ID types: `area_id`, `port_id`, `sem_id`, `team_id`, `thread_id`, `image_id` - all i32-based resource identifiers
- `thread_func` (L32): Function pointer type for thread entry points

### Enumerations
**System State Enums** (L37-235):
- `thread_state` (L39-46): Thread execution states (running, ready, receiving, etc.)
- `image_type` (L49-54): Binary image types (app, library, add-on, system)
- `be_task_flags` (L58-72): Task priority and behavior flags for media/real-time operations
- `scheduler_mode` (L74-77): System scheduler modes (NOTE: typo in enum name - should be "scheduler_mode")
- `path_base_directory` (L80-107): Base directories for path resolution
- `directory_which` (L109-190): Comprehensive system directory enumeration
- `topology_level_type` (L194-200): CPU topology hierarchy levels
- `cpu_platform` (L202-216): Supported CPU architectures including ARM64, RISC-V
- `cpu_vendor` (L218-234): CPU manufacturer identification

### Structures
**System Information Structs** (L237-454):
- `area_info` (L239-251): Memory area metadata with protection, team ownership
- `port_info` (L253-260): IPC port details and queue statistics
- `team_info` (L269-280): Process information including resource counts
- `thread_info` (L295-306): Thread state, timing, and stack information
- `system_info` (L314-340): Global system resource usage and kernel metadata
- `cpu_info` (L308-312): Per-CPU performance and frequency data
- File system structs: `fs_info` (L378-391), `attr_info` (L362-365), `index_info` (L368-375)
- `image_info` (L396-413): Binary image metadata with function pointers (contains FIXME about PartialEq implementation)

**CPU-specific Structs** (L415-477):
- Anonymous structs for CPUID register data (`__c_anonymous_eax_*`)
- `cpuid_info` union (L457-464): Multiple views of CPUID data
- CPU topology structures for hardware discovery

### Constants
**System Limits** (L518-633):
- `B_OS_NAME_LENGTH`, `B_PAGE_SIZE`, `B_INFINITE_TIMEOUT` - fundamental system limits
- Memory area flags: locking modes (L527-533), addressing modes (L535-541), protection bits (L543-547)
- Thread priorities: idle to real-time scale (L562-573)
- File system capabilities and mount flags (L596-615)

**Error Codes** (L651-854):
- Structured error hierarchy with base constants for different subsystems
- General errors (B_NO_MEMORY, B_PERMISSION_DENIED, etc.)
- Kernel kit, application kit, storage kit, media kit specific errors
- POSIX error mappings

**Type Constants** (L856-906):
- Haiku-specific type identifiers using `haiku_constant!` macro
- BMessage type system constants (B_STRING_TYPE, B_INT32_TYPE, etc.)

### Function Declarations
**Memory Management** (L910-936): Area creation, cloning, deletion, and information retrieval
**IPC Operations** (L938-988): Port creation, read/write operations with timeout support
**Synchronization** (L990-1012): Semaphore operations with acquire/release semantics
**Process/Thread Management** (L1014-1065): Thread spawning, control, and information gathering
**File System Extensions** (L1112-1195): Haiku-specific FS operations (attributes, queries, mounting)
**Image Loading** (L1197-1282): Dynamic library and executable loading with symbol resolution

### Inline Helper Functions
**Wrapper Functions** (L1287-1388): Safe wrappers around underscore-prefixed C functions that automatically pass struct sizes, following Rust conventions for C macro equivalents.

## Architecture Notes
- Uses `c_enum!`, `s!`, `s_no_extra_traits!`, and `cfg_if!` macros from libc crate infrastructure
- Conditional trait implementations for unions based on "extra_traits" feature
- Maintains C ABI compatibility while providing Rust type safety
- Extensive use of raw pointers and `extern "C"` function declarations for system integration