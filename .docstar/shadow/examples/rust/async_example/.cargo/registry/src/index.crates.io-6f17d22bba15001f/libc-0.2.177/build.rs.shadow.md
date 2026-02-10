# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/build.rs
@source-hash: f01c77e53ffb343d
@generated: 2026-02-09T18:07:01Z

**Purpose**: Build script for the `libc` crate that sets conditional compilation flags based on target platform and environment variables. Handles platform-specific ABI compatibility settings and version detection.

**Core Architecture**:
- **Configuration Validation**: Uses `ALLOWED_CFGS` (L7-25) and `CHECK_CFG_EXTRA` (L28-43) to define and validate all possible cfg flags for Rust's check-cfg feature
- **Environment Detection**: Reads Cargo and custom environment variables to determine target platform characteristics and feature flags
- **Version-Aware Logic**: Detects compiler and toolchain versions to enable appropriate features and compatibility settings

**Key Functions**:

**`main()` (L45-169)**:
- Primary orchestrator that reads environment variables and sets appropriate cfg flags
- Handles FreeBSD version detection (L57-82) with backward compatibility to v12
- Manages Emscripten version compatibility (L84-88) for stat ABI changes
- Configures musl libc v1.2.3 features (L90-96) for loongarch64 and ohos targets
- Sets up GNU libc time/file offset bits (L104-139) for 32-bit Linux targets
- Enables CI-specific warnings and thread-local features (L141-149)
- Registers check-cfg values for Rust ≥1.80 (L151-169)

**`rustc_minor_nightly()` (L206-245)**:
- Parses rustc version string to extract minor version and nightly status
- Handles clippy-driver wrapper detection and adjustment (L218-220)
- Uses `otry!` macro (L207-214) for error handling with panic on failure
- Critical for determining available Rust features

**`rustc_version_cmd()` (L174-201)**:
- Executes rustc version command with proper wrapper handling
- Supports `RUSTC_WRAPPER` environment variable for build tool integration
- Includes special handling for clippy-driver (L182-184)

**`which_freebsd()` (L248-264)**:
- Detects FreeBSD version by executing `freebsd-version` command
- Returns major version number (10-15) or None if detection fails
- Used for ABI compatibility decisions

**`emcc_version_code()` (L267-289)**:
- Detects Emscripten compiler version for WebAssembly targets
- Returns encoded version number (major*10000 + minor*100 + patch)
- Handles platform-specific executable names and git suffixes

**`set_cfg()` (L292-297)**:
- Validates and emits cargo cfg flags
- Ensures all flags are pre-declared in `ALLOWED_CFGS`
- Central point for all conditional compilation flag setting

**Critical Dependencies**:
- Environment variables: `CARGO_CFG_*`, `RUST_LIBC_UNSTABLE_*`, `LIBC_CI`, `RUSTC`, `RUSTC_WRAPPER`
- External commands: `rustc`, `freebsd-version`, `emcc`
- Target triple components for platform-specific logic

**Key Patterns**:
- Defensive programming with extensive validation of cfg flags
- Environment-driven feature detection with fallback defaults  
- Version-based compatibility logic for multiple toolchains
- Extensive use of cargo rerun-if-changed/env-changed directives for build optimization