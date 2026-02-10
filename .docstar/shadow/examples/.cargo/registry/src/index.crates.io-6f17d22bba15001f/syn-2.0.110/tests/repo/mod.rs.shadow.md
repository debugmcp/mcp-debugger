# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/repo/mod.rs
@source-hash: 4e2d370876192fc0
@generated: 2026-02-09T18:06:33Z

## Purpose
Test infrastructure module for the `syn` crate that manages downloading, filtering, and iterating over Rust source files from the rust-lang/rust repository for comprehensive parsing tests. Maintains exclusion lists for unsupported syntax features and provides utilities for parallel test execution.

## Key Components

### Constants & Configuration
- `REVISION` (L19): Git commit hash for rust-lang/rust repository (nightly-2025-08-14)
- `EXCLUDE_FILES` (L22-448): Extensive static array of 400+ file paths to skip during testing, organized by unsupported syntax features with TODO comments linking to GitHub issues
- `EXCLUDE_DIRS` (L451-465): Directory patterns to exclude (parser errors, fuzz failures, crash tests)
- `UI_TEST_DIRS` (L469): Directories where `.stderr` files indicate test failures

### Core Functions
- `for_each_rust_file()` (L471-501): Main entry point that discovers all `.rs` files in the test corpus, filters out excluded files and files with corresponding `.stderr` files, then executes a callback function in parallel using rayon
- `base_dir_filter()` (L503-527): Directory/file filter predicate that implements the exclusion logic for `WalkDir`
- `clone_rust()` (L557-600): Downloads and unpacks the rust repository if needed, validates exclusion lists against actual filesystem
- `download_and_unpack()` (L602-629): HTTP download and tar.gz extraction implementation

### Utility Functions
- `edition()` (L530-536): Returns Rust edition string based on file path (mostly "2021", special case for one 2015 file)
- `abort_after()` (L539-544): Reads environment variable for test failure threshold
- `rayon_init()` (L546-555): Configures parallel execution thread pool with appropriate stack size

## Dependencies
- `rayon`: Parallel iteration over file collections
- `walkdir`: Recursive directory traversal
- `reqwest`: HTTP client for downloading rust repository
- `flate2`, `tar`: Archive extraction
- `anyhow`: Error handling
- Local `progress` module for download progress tracking

## Architecture Pattern
Implements a comprehensive test corpus management system that:
1. Maintains a curated exclusion list synchronized with syn's parsing capabilities
2. Downloads canonical rust source code for testing
3. Provides parallel iteration over valid test files
4. Validates exclusion lists against actual repository structure

## Critical Invariants
- Exclusion lists must be kept in sync with actual repository structure (validated in `clone_rust()`)
- Files in excluded directories should not appear in excluded files list (validated L574-578)
- No duplicate entries in exclusion lists (validated L571-573, L587-589)