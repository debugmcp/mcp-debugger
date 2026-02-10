# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot_core-0.9.12/build.rs
@source-hash: 3698c936b75f8332
@generated: 2026-02-09T18:14:11Z

**Build Script for Thread Sanitizer Detection**

This build script automatically detects Thread Sanitizer (TSAN) configuration and sets up conditional compilation flags for the parking_lot_core crate.

**Primary Purpose:**
- Cross-compatible TSAN detection for both stable and nightly Rust toolchains
- Configures conditional compilation based on sanitizer presence

**Key Functions:**
- `main()` (L4-11): Primary build script entry point that:
  - Sets up build dependency tracking via `cargo:rerun-if-changed` (L5)
  - Declares custom cfg flag `tsan_enabled` for rustc check-cfg (L6)
  - Reads `CARGO_CFG_SANITIZE` environment variable (L7)
  - Enables `tsan_enabled` cfg flag when thread sanitizer is detected (L8-10)

**Critical Logic:**
- Thread sanitizer detection via string search in `CARGO_CFG_SANITIZE` (L8)
- Conditional cfg flag emission based on sanitizer presence (L9)

**Dependencies:**
- Standard library `std::env` for environment variable access
- Cargo build system integration via `println!` directives

**Architectural Pattern:**
- Build-time feature detection pattern
- Environment-driven conditional compilation
- Compatible with both stable and nightly Rust (sanitizer support varies)