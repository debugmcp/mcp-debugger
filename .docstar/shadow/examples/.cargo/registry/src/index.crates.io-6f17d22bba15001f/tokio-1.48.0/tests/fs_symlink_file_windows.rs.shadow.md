# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/fs_symlink_file_windows.rs
@source-hash: 02ba203872a6ddd2
@generated: 2026-02-09T18:12:11Z

## Primary Purpose
Windows-specific integration test for Tokio's async filesystem symlink functionality, verifying that file symlinks work correctly and reflect changes to the source file.

## Key Components
- **symlink_file_windows test function (L9-24)**: Main test that creates a file, creates a symlink to it, modifies the source, and verifies both source and symlink contain the same data
- **Temporary directory setup (L10)**: Uses `tempfile::tempdir()` for isolated test environment
- **File operations sequence (L12-23)**: Creates source file, symlinks it, modifies source, reads both files, and asserts equality

## Dependencies
- `tempfile`: For creating temporary test directories
- `tokio::fs`: Async filesystem operations (write, symlink_file, read)

## Platform Constraints
- **Windows-only (L3)**: Conditional compilation for Windows targets only
- **Feature-gated (L2)**: Requires "full" feature, excludes WASI targets
- **Lint configuration (L1)**: Enforces Rust 2018 idioms

## Test Logic
1. Creates temporary directory with two file paths: "foo.txt" and "bar.txt"
2. Writes initial content to source file (L15)
3. Creates symlink from source to destination (L16)
4. Overwrites source with new content (L18)
5. Reads both files and verifies symlink reflects source changes (L20-23)

## Key Behaviors Verified
- File symlinks can be created successfully on Windows
- Symlinked files automatically reflect changes made to source files
- Async filesystem operations work correctly with symlinks