# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/apple/b64/mod.rs
@source-hash: 75a313514fd3b9f2
@generated: 2026-02-09T18:02:11Z

## Purpose
Platform-specific definitions module for 64-bit Apple systems (iOS/macOS), providing low-level C interop structures, constants, and function bindings specific to 64-bit Apple architectures.

## Key Structures

**timeval32** (L6-9): 32-bit time value representation with second and microsecond fields, used for legacy compatibility.

**if_data** (L11-41): Comprehensive network interface statistics structure containing interface metadata, packet counters, error counts, and bandwidth metrics. Uses `timeval32` for the `ifi_lastchange` field.

**bpf_hdr** (L43-48): Berkeley Packet Filter header structure for packet capture, containing timestamp, capture length, data length, and header length fields.

**pthread_attr_t** (L52-55): POSIX thread attributes structure with opaque 56-byte implementation-specific data.

**pthread_once_t** (L57-60): Thread synchronization primitive for one-time initialization, using `__PTHREAD_ONCE_SIZE__` constant.

## Threading Constants (L106-111)
Defines size constants for pthread structures:
- `__PTHREAD_MUTEX_SIZE__`: 56 bytes
- `__PTHREAD_COND_SIZE__`: 40 bytes  
- `__PTHREAD_CONDATTR_SIZE__`: 8 bytes
- `__PTHREAD_ONCE_SIZE__`: 8 bytes
- `__PTHREAD_RWLOCK_SIZE__`: 192 bytes
- `__PTHREAD_RWLOCKATTR_SIZE__`: 16 bytes

## I/O Control Constants (L113-119)
Terminal and BPF ioctl operation codes:
- `TIOCTIMESTAMP`, `TIOCDCDTIMESTAMP`: Terminal timestamping
- `BIOCSETF`, `BIOCSRTIMEOUT`, `BIOCGRTIMEOUT`, `BIOCSETFNR`: BPF operations

## External Functions
**exchangedata** (L128): C function for atomic data exchange between two file paths.

## Architecture Dispatch (L132-140)
Conditionally includes architecture-specific modules:
- x86_64 module for Intel 64-bit
- aarch64 module for ARM 64-bit

## Design Patterns
- Uses libc crate's `s!` and `s_no_extra_traits!` macros for structure definitions
- Conditional trait implementations via `cfg_if!` for `extra_traits` feature
- Manual trait implementations for opaque pthread types when extra traits enabled
- Architecture-specific module loading pattern for multi-platform support