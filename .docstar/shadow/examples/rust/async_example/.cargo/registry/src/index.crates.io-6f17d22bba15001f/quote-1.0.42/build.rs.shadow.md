# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/quote-1.0.42/build.rs
@source-hash: cd6808c02e476b09
@generated: 2026-02-09T18:06:52Z

## Purpose
Cargo build script for the `quote` crate that performs Rust compiler version detection and sets conditional compilation flags based on feature availability.

## Key Functions

**main() (L5-21)**
- Entry point that controls the build process
- Sets up cargo rebuild trigger on build script changes (L6)
- Detects Rust minor version and conditionally enables/disables features
- Configures `no_diagnostic_namespace` cfg flag based on Rust 1.78+ availability

**rustc_minor_version() (L23-32)**
- Extracts minor version number from `rustc --version` output
- Returns `Option<u32>` representing the minor version (e.g., 78 for Rust 1.78)
- Handles parsing failures gracefully by returning `None`
- Uses environment variable `RUSTC` to locate compiler binary

## Dependencies
- `std::env` - Environment variable access for RUSTC path
- `std::process::Command` - Subprocess execution for version detection
- `std::str` - String parsing utilities

## Architectural Decisions

**Feature Detection Pattern**
- Uses runtime compiler version detection rather than compile-time feature probes
- Implements defensive programming with early return on version detection failure
- Employs cargo's `rustc-cfg` mechanism to conditionally enable features

**Version Thresholds**
- Rust 1.77+: Enables `rustc-check-cfg` for configuration validation
- Rust 1.78+: Diagnostic namespace support available (disables fallback cfg)
- Pre-1.78: Sets `no_diagnostic_namespace` flag for compatibility shims

## Critical Constraints
- Relies on stable rustc version output format ("rustc 1.X.Y")
- Version detection failure results in conservative feature disabling
- Build script must be deterministic for cargo caching