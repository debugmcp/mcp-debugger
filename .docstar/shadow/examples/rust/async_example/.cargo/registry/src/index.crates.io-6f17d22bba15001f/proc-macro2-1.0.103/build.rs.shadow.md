# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/build.rs
@source-hash: baeb20b52f6b536b
@generated: 2026-02-09T18:06:59Z

**Build Script for proc-macro2 Crate Feature Detection**

This is a Cargo build script (`build.rs`) for the `proc-macro2` crate that performs Rust compiler version detection and feature probing to configure conditional compilation flags. The script enables different code paths based on rustc version and available proc-macro features.

## Key Functions

- **main() (L14-148)**: Primary orchestrator that detects rustc version, configures check-cfg declarations for newer compilers (≥1.80), and conditionally enables features based on compiler capabilities and environment variables.

- **compile_probe_unstable(feature, rustc_bootstrap) (L150-159)**: Probes for unstable compiler features, avoiding execution during rustc bootstrap stages due to known issues.

- **compile_probe_stable(feature) (L161-163)**: Probes for stable compiler features, with special handling for rustc bootstrap environments.

- **do_compile_probe(feature, rustc_bootstrap) (L165-246)**: Core feature detection engine that attempts to compile probe files from `src/probe/` directory using the target compiler configuration. Creates temporary compilation to test feature availability.

- **rustc_minor_version() (L248-257)**: Extracts Rust compiler minor version by parsing `rustc --version` output.

- **cargo_env_var(key) (L259-267)**: Safe environment variable getter that exits with error message if required Cargo variables are missing.

## Conditional Feature Configuration

The script configures these cargo cfg flags based on compiler version:
- `no_is_available` (rustc < 57): Disables `proc_macro::is_available()` usage
- `no_source_text` (rustc < 66): Disables `Span::source_text()` calls  
- `no_literal_byte_character`, `no_literal_c_string` (rustc < 79): Disables certain literal constructors
- `span_locations`: Enabled when semver-exempt or span-locations feature active
- `wrap_proc_macro`: Wraps libproc_macro types instead of polyfilling
- `proc_macro_span`: Enables unstable span functionality on nightly/bootstrap
- `proc_macro_span_location`, `proc_macro_span_file` (rustc ≥ 88): Enables span location methods

## Environment Sensitivity

Responds to `RUSTC_BOOTSTRAP` environment variable for unstable feature access on stable/beta compilers. Handles `RUSTC_STAGE` to avoid issues during rustc's own bootstrap process.

## Architecture Notes

- Uses compile-time probing rather than version checks alone for robust feature detection
- Implements careful cleanup of temporary compilation artifacts to ensure reproducible builds
- Special handling for NFSv3 filesystem timing issues during cleanup (L230-243)