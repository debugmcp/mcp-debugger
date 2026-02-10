# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot_core-0.9.12/build.rs
@source-hash: 3698c936b75f8332
@generated: 2026-02-09T18:06:54Z

**Primary Purpose**: Build script for parking_lot_core crate that automatically detects ThreadSanitizer (tsan) configuration and sets appropriate conditional compilation flags.

**Key Functions**:
- `main()` (L4-11): Entry point that performs sanitizer detection and cfg flag configuration

**Core Logic**:
- Sets up cargo build dependency tracking on the build script itself (L5)
- Registers custom cfg flag `tsan_enabled` with rustc (L6)
- Reads `CARGO_CFG_SANITIZE` environment variable to detect enabled sanitizers (L7)
- Conditionally enables `tsan_enabled` cfg flag when "thread" sanitizer is detected (L8-10)

**Architecture Pattern**: 
Standard Rust build script following cargo conventions. Uses environment variable inspection to bridge the gap between stable and nightly Rust compiler sanitizer support.

**Dependencies**:
- `std::env` for environment variable access
- Cargo build system integration via `println!` directives

**Critical Behavior**:
The script enables cross-compatibility between stable Rust (no sanitizer support) and nightly Rust (with sanitizer support) by detecting sanitizer configuration at build time rather than compile time. The `tsan_enabled` flag can then be used in conditional compilation throughout the crate.