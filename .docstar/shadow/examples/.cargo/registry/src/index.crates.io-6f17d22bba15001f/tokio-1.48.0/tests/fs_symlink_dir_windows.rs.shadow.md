# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/fs_symlink_dir_windows.rs
@source-hash: bec061561203ccdc
@generated: 2026-02-09T18:12:10Z

## Purpose
Windows-specific integration test for Tokio's filesystem symlink directory functionality. Tests that directory symbolic links correctly mirror file operations between original and linked directories.

## Key Components
- **symlink_file_windows test function (L8-31)**: Async test that validates directory symlink behavior by:
  1. Creating temporary directory structure with file content
  2. Creating directory symlink using `fs::symlink_dir()`
  3. Modifying original file and verifying changes are visible through symlink
  4. Asserting content equality between original and symlinked file paths

## Dependencies
- **tempfile**: Provides temporary directory creation for test isolation
- **tokio::fs**: Core filesystem operations (create_dir, write, read, symlink_dir)

## Platform Constraints
- **Windows-only (L3)**: Uses `#[cfg(windows)]` conditional compilation
- **Feature-gated (L2)**: Requires "full" feature, excludes WASI target
- **Rust 2018 idioms (L1)**: Enforces modern Rust coding patterns

## Test Pattern
Creates directory "a" with file "abc.txt", symlinks to directory "b", modifies original file, then verifies both paths read identical content - validating that directory symlinks provide transparent access to contained files.

## Critical Behavior
Directory symlinks on Windows must maintain file system coherence where modifications to files in the original directory are immediately visible through the symlinked directory path.