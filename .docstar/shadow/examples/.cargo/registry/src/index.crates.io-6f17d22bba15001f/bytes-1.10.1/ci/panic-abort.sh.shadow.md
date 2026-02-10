# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/ci/panic-abort.sh
@source-hash: aec2e5427117e533
@generated: 2026-02-09T18:11:22Z

## Primary Purpose
Bash script for running Rust tests with panic-abort configuration in CI environments. This script modifies the panic behavior to abort immediately on panic rather than unwinding, which can improve test performance and detect certain classes of bugs.

## Key Components
- **Shebang and configuration (L1-3)**: Sets bash execution with error handling (`set -ex`)
- **Test execution (L4)**: Runs comprehensive test suite with panic=abort configuration

## Script Behavior
The script configures the Rust compiler to:
- Use `panic=abort` strategy instead of default unwinding
- Enable `panic-abort-tests` for test binaries specifically
- Execute all tests across all feature combinations (`--all-features`)
- Run all available test files (`--test '*'`)

## Environment Integration
- Preserves existing `RUSTFLAGS` while appending panic configuration
- Designed for CI pipeline execution with fail-fast behavior (`set -e`)
- Provides verbose output for debugging CI issues (`set -x`)

## Purpose in Build System
This is a specialized CI script that validates the crate's compatibility with panic=abort compilation mode, ensuring the library works correctly in environments that require immediate abort on panic rather than stack unwinding.