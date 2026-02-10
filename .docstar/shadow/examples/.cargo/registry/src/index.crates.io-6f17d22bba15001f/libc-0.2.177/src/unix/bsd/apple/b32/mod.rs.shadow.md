# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/apple/b32/mod.rs
@source-hash: 56e90d43e36bcf0a
@generated: 2026-02-09T18:02:15Z

## Purpose and Responsibility

32-bit specific type definitions and constants for Apple platforms (iOS/Darwin). Provides low-level system interfaces, network structures, pthread primitives, and BSD packet filtering definitions specifically tailored for 32-bit Apple architectures.

## Key Structures

**if_data (L8-38)**: Network interface statistics structure containing interface type information, packet/byte counters, error counts, and timing data. Key fields include `ifi_mtu`, `ifi_ipackets`/`ifi_opackets` for packet counts, `ifi_ibytes`/`ifi_obytes` for byte counts, and `ifi_lastchange` timestamp.

**bpf_hdr (L40-45)**: Berkeley Packet Filter header structure with timestamp (`bh_tstamp`), captured length (`bh_caplen`), original packet length (`bh_datalen`), and header length (`bh_hdrlen`).

**malloc_zone_t (L47-49)**: Memory allocation zone structure with private implementation details hidden behind 18 `uintptr_t` array.

**pthread_attr_t (L53-56)**: pthread attribute structure with signature and 36-byte opaque data area.

**pthread_once_t (L58-61)**: pthread once control structure using signature and size-controlled opaque data.

**max_align_t (L64-66)**: 16-byte aligned structure for maximum alignment requirements using two `f64` values.

## Conditional Trait Implementations (L69-106)

When `extra_traits` feature is enabled, provides `PartialEq`, `Eq`, and `Hash` implementations for `pthread_attr_t` and `pthread_once_t`. Comparisons check both signature field and byte-by-byte opaque data equality.

## Constants and System Values

**pthread sizing constants (L112-117)**: Defines sizes for various pthread primitives (`__PTHREAD_MUTEX_SIZE__`, `__PTHREAD_COND_SIZE__`, etc.).

**ioctl constants (L119-125)**: Terminal and BPF ioctl command codes for timestamp operations and packet filtering.

**PTHREAD_ONCE_INIT (L128-131)**: Static initializer for pthread_once_t with magic signature `0x30B1BCBA`.

## External Function

**exchangedata (L134)**: Foreign function interface for atomic data exchange between two file paths with options parameter.

## Dependencies

- `crate::prelude::*` for common type aliases
- `crate::timeval` for timestamp structures
- Uses libc-style type aliases (`c_int`, `c_uchar`, etc.)
- Relies on `cfg_if!` macro for conditional compilation
- Uses `s!` and `s_no_extra_traits!` macros for structure definitions

## Architectural Notes

Part of hierarchical BSD/Apple platform definitions within libc crate. The 32-bit specificity affects structure layouts and constant values. The private nature of `malloc_zone_t` internals suggests ABI stability concerns.