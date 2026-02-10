# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/fs_rename.rs
@source-hash: c5397d389b2aefef
@generated: 2026-02-09T18:12:09Z

**Purpose:** Integration test for Tokio's async filesystem rename operation, verifying the atomic move behavior of `fs::rename`.

**Key Test Function:**
- `rename_file()` (L7-28): Async test that validates file rename functionality by creating a temporary file, renaming it, and verifying the original file no longer exists while the new file is accessible.

**Test Flow:**
1. Creates temporary directory using `tempfile::tempdir()` (L9)
2. Writes test content to initial file "a.txt" (L11-13)
3. Verifies initial file exists using `fs::try_exists()` (L15)
4. Renames file to "b.txt" using `fs::rename()` (L17-19)
5. Confirms renamed file exists (L21)
6. Validates original file no longer exists with error handling (L24-27)

**Dependencies:**
- `tokio::fs` - Async filesystem operations
- `tempfile` - Temporary directory creation for isolated testing

**Test Configuration:**
- Conditional compilation excludes WASI targets (L2) due to limited filesystem support
- Uses `#[tokio::test]` macro for async test execution
- Enables rust_2018_idioms warnings (L1)

**Error Handling Pattern:**
The test gracefully handles potential `try_exists` errors after rename (L24-27), acknowledging that some filesystems may have race conditions or permission issues when checking non-existent files immediately after rename operations.