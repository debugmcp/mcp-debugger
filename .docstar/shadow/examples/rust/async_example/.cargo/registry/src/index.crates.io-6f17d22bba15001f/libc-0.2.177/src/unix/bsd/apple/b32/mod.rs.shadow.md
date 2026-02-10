# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/apple/b32/mod.rs
@source-hash: 56e90d43e36bcf0a
@generated: 2026-02-09T17:57:10Z

## Purpose
Platform-specific definitions for 32-bit Apple systems (iOS/macOS). Provides C FFI bindings for system data structures, threading primitives, and network/device I/O interfaces.

## Key Types and Structures

### Core Data Types
- `boolean_t` (L5): Apple's boolean type alias for `c_int`
- `max_align_t` (L63-66): 16-byte aligned structure for maximum alignment guarantees

### Network Interface Data
- `if_data` (L8-38): Network interface statistics structure with comprehensive metrics including packet counts, error counts, byte counters, timing information, and hardware assist flags
- `bpf_hdr` (L40-45): Berkeley Packet Filter header containing timestamp, capture length, data length, and header length

### Threading Primitives
- `pthread_attr_t` (L53-56): Thread attributes with signature and 36-byte opaque data
- `pthread_once_t` (L58-61): One-time initialization control with signature and platform-specific opaque storage
- `PTHREAD_ONCE_INIT` (L128-131): Properly initialized pthread_once_t constant

### Memory Management
- `malloc_zone_t` (L47-49): Memory zone structure with private 18-pointer opaque implementation

## Constants and Configuration

### Threading Constants (L112-117)
Platform-specific sizes for pthread synchronization primitives (mutex: 40, condition: 24, rwlock: 124 bytes)

### I/O Control Constants (L119-125)
- Terminal I/O: `TIOCTIMESTAMP`, `TIOCDCDTIMESTAMP` for timestamp operations
- BPF operations: `BIOCSETF`, `BIOCSRTIMEOUT`, `BIOCGRTIMEOUT`, `BIOCSETFNR` for packet filtering

### Legacy Constants
- `NET_RT_MAXID` (L110): Deprecated network routing constant

## External Functions
- `exchangedata` (L134): Apple-specific function for atomic data exchange between files

## Architecture Notes
- Uses libc's structured definition macros (`s!`, `s_no_extra_traits!`)
- Conditionally implements `PartialEq`, `Eq`, and `Hash` traits when "extra_traits" feature is enabled (L70-105)
- 32-bit specific field sizes and alignments throughout
- Maintains ABI compatibility with Apple's system libraries