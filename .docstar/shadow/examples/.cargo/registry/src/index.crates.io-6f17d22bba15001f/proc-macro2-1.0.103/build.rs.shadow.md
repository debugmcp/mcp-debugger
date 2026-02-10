# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/build.rs
@source-hash: baeb20b52f6b536b
@generated: 2026-02-09T18:14:21Z

**Purpose**: Cargo build script for proc-macro2 crate that performs feature detection and conditional compilation configuration based on Rust compiler version and available features.

**Core Functionality**:
- **main() (L14-148)**: Primary entry point that orchestrates feature detection and cfg attribute emission
- **rustc_minor_version() (L248-257)**: Extracts Rust compiler minor version from `rustc --version` output
- **cargo_env_var() (L259-267)**: Safe wrapper for retrieving required Cargo environment variables with error handling

**Feature Detection System**:
- **compile_probe_unstable() (L150-159)**: Tests unstable compiler features, respects RUSTC_STAGE environment
- **compile_probe_stable() (L161-163)**: Tests stable compiler features with bootstrap consideration
- **do_compile_probe() (L165-246)**: Core compilation probe that attempts to compile test files in `src/probe/` directory

**Configuration Logic**:
1. **Rust Version Checks (L17-67)**: Enables cfg attributes based on compiler version thresholds:
   - rustc >= 80: Enables cargo check-cfg declarations
   - rustc < 57: Sets `no_is_available` for proc_macro API polyfilling
   - rustc < 66: Sets `no_source_text` to disable Span::source_text
   - rustc < 79: Sets literal method restrictions

2. **Feature Flag Processing (L36-47)**: Handles `procmacro2_semver_exempt` and `span-locations` features

3. **Proc Macro Span Detection (L74-147)**: Complex logic determining proc_macro span API availability:
   - Tests unstable features with/without RUSTC_BOOTSTRAP
   - Sets `wrap_proc_macro`, `proc_macro_span`, `proc_macro_span_location`, `proc_macro_span_file` configs
   - Handles nightly vs stable compiler differences

**Key Dependencies**:
- Standard library modules for file system, process management, environment access
- Relies on probe files in `src/probe/` directory for feature compilation tests
- Uses Cargo environment variables (RUSTC, OUT_DIR, TARGET, CARGO_ENCODED_RUSTFLAGS)

**Architecture Pattern**: 
Build-time feature detection using compilation probes - attempts to compile small test programs to determine available compiler features, then emits corresponding cfg attributes for conditional compilation.

**Critical Constraints**:
- Handles RUSTC_STAGE environment for bootstrap compilation scenarios
- Manages RUSTC_WRAPPER and RUSTC_WORKSPACE_WRAPPER for wrapped compilers
- Performs cleanup of temporary compilation artifacts to ensure reproducible builds
- Error handling for filesystem operations with special handling for NFS timing issues (L230-243)