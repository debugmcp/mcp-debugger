# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/fs_copy.rs
@source-hash: 9bbf6f89b0a7aac7
@generated: 2026-02-09T18:12:05Z

## Purpose
Test suite for Tokio's async filesystem copy operations, specifically validating `tokio::fs::copy()` functionality for both content copying and permission preservation.

## Key Test Functions
- **`copy()` (L9-22)**: Basic file copying test that verifies content is correctly copied from source to destination using `tokio::fs::copy()`
- **`copy_permissions()` (L26-41)**: Advanced test ensuring file permissions are preserved during copy operations, specifically testing readonly permission retention

## Dependencies
- **tempfile::tempdir**: Creates temporary directories for isolated test environments
- **tokio::fs**: Provides async filesystem operations (`write`, `copy`, `read`, `File::create`, `metadata`)

## Test Environment Constraints
- **Platform exclusions (L2)**: Disabled on WASI targets due to limited filesystem operation support
- **Miri exclusions (L8, L25)**: Tests ignored under Miri due to missing `fchmod` support
- **Feature gates**: Requires "full" feature flag for complete Tokio functionality

## Test Patterns
Both tests follow a consistent pattern:
1. Create temporary directory for isolation
2. Set up source file with specific content/permissions
3. Execute `tokio::fs::copy()` operation
4. Verify operation success through assertions

## Key Operations Tested
- Async file writing and reading
- File copying with content preservation
- Permission metadata copying and verification
- Temporary file cleanup (implicit via tempdir)