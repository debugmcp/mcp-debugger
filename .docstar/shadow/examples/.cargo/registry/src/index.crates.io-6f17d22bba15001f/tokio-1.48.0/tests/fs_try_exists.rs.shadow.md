# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/fs_try_exists.rs
@source-hash: edef7a79a2c1728d
@generated: 2026-02-09T18:12:11Z

## File Purpose
Test file validating the behavior of `tokio::fs::try_exists()` function across different scenarios including existing files, non-existing files, and permission-denied cases.

## Key Test Function
- **try_exists()** (L9-48): Async test function that comprehensively tests the `tokio::fs::try_exists()` API

## Test Scenarios Covered
1. **Existing file verification** (L12-16): Creates a file and verifies `try_exists()` returns `true`
2. **Non-existing file verification** (L14-17): Tests that `try_exists()` returns `false` for non-existent paths
3. **Permission denied handling** (L19-47): Unix-specific test that creates a file in a directory with restricted permissions (mode 0o244) and verifies `try_exists()` returns `PermissionDenied` error

## Dependencies
- `tempfile::tempdir`: For creating temporary test directories
- `tokio::fs`: Core filesystem operations being tested
- `std::os::unix::prelude::PermissionsExt`: Unix permission manipulation

## Platform-Specific Behavior
- **WASI exclusion** (L2): Test disabled on WASI targets due to limited filesystem support
- **FreeBSD exemption** (L18-22): Permission test skipped on FreeBSD where root always has stat permission
- **io-uring exclusion** (L21): Also skips permission test when using unstable io-uring feature
- **Miri exclusion** (L8): Test ignored in Miri due to lack of `chmod` support

## Test Pattern
Uses temporary directory cleanup pattern with `tempfile::tempdir()` for isolated test execution. Tests both success cases (boolean returns) and error cases (specific error kinds).