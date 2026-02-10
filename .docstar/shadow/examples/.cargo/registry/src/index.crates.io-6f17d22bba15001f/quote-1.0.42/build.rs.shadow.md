# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/quote-1.0.42/build.rs
@source-hash: cd6808c02e476b09
@generated: 2026-02-09T18:13:18Z

## Purpose
Build script for the `quote` crate that conditionally enables Rust compiler features based on the detected rustc version. Specifically manages compatibility with the `#[diagnostic]` tool attribute namespace introduced in Rust 1.78.

## Key Functions

**`main()` (L5-21)**
- Entry point that orchestrates version detection and feature configuration
- Sets up cargo rerun trigger on build script changes (L6)
- Detects rustc minor version and configures conditional compilation features
- Enables `rustc-check-cfg` for Rust 1.77+ to validate custom cfg attributes (L12-14)
- Sets `no_diagnostic_namespace` cfg flag for Rust versions < 1.78 (L18-20)

**`rustc_minor_version()` (L23-32)**
- Extracts minor version number from rustc by executing `rustc --version`
- Returns `Option<u32>` representing the minor version (e.g., 78 for rustc 1.78.x)
- Parses version string expecting format "rustc 1.X.Y" and extracts X (L27-31)
- Handles errors gracefully by returning None for any parsing failures

## Dependencies
- `std::env` - Access to RUSTC environment variable
- `std::process::Command` - Execute rustc subprocess  
- `std::str` - UTF-8 string parsing

## Architectural Pattern
This is a conditional compilation build script that enables backward compatibility by detecting compiler capabilities at build time. The pattern allows the crate to use newer Rust features when available while maintaining support for older compiler versions.

## Critical Logic
- Version threshold at Rust 1.78 determines diagnostic namespace support
- Fallback behavior: if version detection fails, no special cfg flags are set
- Uses cargo's cfg system to conditionally compile code paths based on compiler version