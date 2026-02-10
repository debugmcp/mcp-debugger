# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/apple/b64/mod.rs
@source-hash: 75a313514fd3b9f2
@generated: 2026-02-09T17:57:12Z

## Purpose
Platform-specific system definitions for 64-bit Apple platforms (iOS/macOS). Part of the libc crate's platform abstraction layer, providing C-compatible struct definitions and constants for system-level programming on Apple's 64-bit architectures.

## Key Structures

### timeval32 (L6-9)
32-bit time value structure with seconds and microseconds fields. Used for timestamp representations in legacy APIs.

### if_data (L11-41) 
Network interface statistics structure containing comprehensive interface metrics:
- Interface type/configuration fields (L12-19)
- Performance metrics: MTU, baudrate, packet counts, error counts (L20-35)  
- Timing information with timeval32 timestamp (L36)
- Hardware assist and reserved fields (L38-40)

### bpf_hdr (L43-48)
Berkeley Packet Filter header structure for packet capture:
- Timestamp using timeval32 (L44)
- Capture and data lengths (L45-46)
- Header length field (L47)

### pthread_attr_t (L52-55)
POSIX thread attributes with opaque 56-byte storage and signature field.

### pthread_once_t (L57-60)
Thread synchronization primitive for one-time initialization with configurable opaque storage size.

## Trait Implementations (L63-100)
Conditional implementations of PartialEq, Eq, and Hash for pthread types when "extra_traits" feature is enabled. Uses element-wise comparison for opaque arrays.

## Constants

### pthread Constants (L106-111)
Size definitions for various pthread primitive storage requirements (mutex: 56, condition: 40, etc.).

### ioctl Constants (L113-119)
Platform-specific ioctl command codes for timestamp and BPF operations.

### Initialization Constants (L121-125)
PTHREAD_ONCE_INIT constant with magic signature value 0x30B1BCBA.

## External Functions
- exchangedata (L128): Apple-specific function for atomic data exchange between files

## Architecture Dependencies (L131-141)
Conditional module inclusion based on target architecture (x86_64 vs aarch64), with fallback for unknown architectures.

## Dependencies
- Uses crate prelude for common type imports (L3)
- References crate-level timeval32 type (L44)
- Leverages s! and s_no_extra_traits! macros for struct definitions