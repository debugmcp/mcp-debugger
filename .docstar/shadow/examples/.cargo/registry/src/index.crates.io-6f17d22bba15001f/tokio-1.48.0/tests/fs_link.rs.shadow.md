# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/fs_link.rs
@source-hash: 74db266a90cd0450
@generated: 2026-02-09T18:12:09Z

## Purpose
Test file for Tokio's filesystem linking operations, specifically hard links and symbolic links functionality.

## Key Test Functions

### `test_hard_link` (L11-33)
- **Purpose**: Tests `tokio::fs::hard_link()` async function behavior
- **Platform constraints**: Excluded from WASI and Miri execution environments (L2, L10)
- **Test flow**:
  1. Creates temporary source and destination files (L12-14)
  2. Writes initial content "hello" to source (L16-19)
  3. Creates hard link using `fs::hard_link(&src, &dst)` (L21)
  4. Overwrites source with "new-data" (L23-26)
  5. Verifies destination reflects changes via shared inode (L28-29)
  6. Confirms it's not a symlink by ensuring `read_link` fails (L32)

### `test_symlink` (L37-62)
- **Purpose**: Tests Unix symbolic link operations
- **Platform constraint**: Unix-only via `#[cfg(unix)]` (L35)
- **Test operations**:
  1. Creates source file with "hello" content (L38-45)
  2. Creates symlink using `fs::symlink(&src, &dst)` (L47)
  3. Modifies source content to "new-data" (L49-52)
  4. Verifies symlink reflects source changes (L54-55)
  5. Validates symlink target with `fs::read_link()` (L57-58)
  6. Confirms symlink metadata with `fs::symlink_metadata()` (L60-61)

## Dependencies
- `tokio::fs` - Core async filesystem operations
- `tempfile::tempdir` - Temporary directory creation for isolated testing
- Standard library `std::io::Write` for synchronous file operations

## Architecture Notes
- Tests use mixed sync/async patterns: synchronous file creation with async Tokio fs operations
- Temporary directories ensure test isolation and automatic cleanup
- Platform-specific conditionals handle OS capability differences
- Tests verify both functional behavior and metadata correctness