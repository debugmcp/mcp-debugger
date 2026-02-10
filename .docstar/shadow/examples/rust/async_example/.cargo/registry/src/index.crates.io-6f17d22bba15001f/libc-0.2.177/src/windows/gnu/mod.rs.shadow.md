# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/windows/gnu/mod.rs
@source-hash: f8c154637cd4b9b5
@generated: 2026-02-09T18:03:13Z

## Primary Purpose
GNU-specific definitions for Windows targets in the libc crate. Provides platform-specific type definitions, constants, and function declarations that differ between MSVC and GNU toolchain on Windows.

## Key Components

### Type Definitions
- **max_align_t (L5-18)**: Architecture-dependent maximum alignment type using conditional compilation:
  - 64-bit targets: 16-byte aligned struct with 4x f64 array (L7-9)
  - 32-bit targets: 16-byte aligned struct with 6x i64 array (L14-16)
  - Uses `s_no_extra_traits!` macro to limit auto-derived traits

### Constants
- **L_tmpnam (L21)**: Maximum length of temporary filename (14 characters)
- **TMP_MAX (L22)**: Maximum number of temporary files (32767)
- **Standard file descriptors (L25-27)**: STDIN=0, STDOUT=1, STDERR=2

### External Functions
- **strcasecmp (L30)**: Case-insensitive string comparison
- **strncasecmp (L31)**: Case-insensitive string comparison with length limit
- **wmemchr (L35)**: Wide character memory search function

## Dependencies
- Uses `crate::prelude::*` for common type definitions
- References `crate::wchar_t` for wide character type
- Utilizes `cfg_if!` macro for conditional compilation

## Architectural Notes
- Architecture-specific type sizing ensures proper memory alignment across different pointer widths
- GNU-specific functions not available in MSVC are declared here
- Comment on L33-34 explains MSVC inline function limitation for `wmemchr`

## Platform Context
This module specifically handles GNU toolchain differences from the main Windows MSVC implementation, particularly around string handling functions and alignment requirements.