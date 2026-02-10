# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/build.rs
@source-hash: f01c77e53ffb343d
@generated: 2026-02-09T18:14:28Z

## Primary Purpose
Build script for the libc crate that detects platform-specific features and sets conditional compilation flags based on target environment and compiler version. Manages ABI compatibility across different FreeBSD versions and glibc configurations.

## Key Functions and Their Roles

**main()** (L45-170): Entry point that orchestrates all platform detection and configuration:
- Extracts target environment variables and compiler information
- Handles FreeBSD version detection and ABI configuration (L64-82)
- Manages Emscripten version compatibility (L84-88)
- Configures musl and Linux time handling (L90-139)
- Sets up check-cfg for Rust 1.80+ (L153-169)

**rustc_minor_nightly()** (L206-246): Parses rustc version string to extract minor version number and nightly status:
- Handles clippy-driver detection and re-execution
- Uses macro `otry!` for error handling (L207-214)
- Returns tuple of (minor_version, is_nightly)

**rustc_version_cmd()** (L174-202): Executes rustc --version command with proper wrapper handling:
- Respects RUSTC_WRAPPER environment variable
- Handles clippy-driver special case with --rustc flag

**which_freebsd()** (L248-265): Detects FreeBSD version by executing freebsd-version command:
- Returns None if command fails or version unrecognized
- Maps version strings to integer versions (10-15)

**emcc_version_code()** (L267-290): Detects Emscripten compiler version:
- Handles platform-specific emcc executable names
- Parses semantic version into numeric code (major*10000 + minor*100 + patch)
- Supports versions with -git suffix

**set_cfg()** (L292-298): Helper to emit cargo configuration flags:
- Validates against ALLOWED_CFGS whitelist
- Emits cargo:rustc-cfg directives

## Important Configuration Constants

**ALLOWED_CFGS** (L7-25): Whitelist of permitted configuration flags including FreeBSD versions, GNU feature flags, and platform-specific options

**CHECK_CFG_EXTRA** (L28-43): Additional target configurations for check-cfg validation covering extended target_os, target_env, and target_arch values

## Critical Platform Logic

- **FreeBSD ABI Management**: Defaults to FreeBSD 12 ABI for compatibility, with CI-based exact version detection
- **GNU glibc Time/File Bits**: Complex logic (L104-139) for handling 32-bit vs 64-bit time_t and file offset configurations with mutual exclusions
- **Emscripten Compatibility**: Versions < 3.1.42 use old stat ABI
- **Rust Version Adaptation**: Adjusts check-cfg syntax based on rustc minor version (75+ vs 80+)

## Environment Variable Dependencies
- CARGO_FEATURE_RUSTC_DEP_OF_STD, LIBC_CI for build context
- RUST_LIBC_UNSTABLE_* family for feature toggles
- CARGO_CFG_TARGET_* for target platform detection
- RUSTC, RUSTC_WRAPPER for compiler configuration