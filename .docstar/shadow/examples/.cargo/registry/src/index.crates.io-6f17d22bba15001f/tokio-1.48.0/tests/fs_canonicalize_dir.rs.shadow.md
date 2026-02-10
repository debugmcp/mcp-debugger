# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/fs_canonicalize_dir.rs
@source-hash: f08d79322e814eeb
@generated: 2026-02-09T18:12:06Z

**Primary Purpose**: Test file validating the behavior of Tokio's async `fs::canonicalize` function across different operating systems (Unix and Windows).

**Test Functions**:
- `canonicalize_root_dir_unix` (L8-10): Tests canonicalization of root directory `"/.` on Unix systems, expecting result `"/"`
- `canonicalize_root_dir_windows` (L14-22): Tests canonicalization of `"C:\\.\\"` on Windows, expecting UNC path format starting with `"\\\\"` and ending with `"C:\\"`

**Dependencies**:
- `tokio::fs` (L4): Async filesystem operations module
- `tokio::test` attribute: Enables async test execution

**Platform-Specific Behavior**:
- Unix tests (L7): Uses `#[cfg(unix)]` conditional compilation
- Windows tests (L13): Uses `#[cfg(windows)]` conditional compilation
- WASI exclusion (L2): Entire file excluded on WASI targets due to limited filesystem support

**Key Patterns**:
- Two-step let bindings on Windows (L16-18) to handle Rust memory semantics for temporary values
- Platform-specific path expectations: Unix expects simple absolute path, Windows expects UNC format
- Error handling via `.unwrap()` calls, assuming canonicalization succeeds in test environment

**Test Validation**:
- Unix: Direct string equality check against `"/"`
- Windows: Pattern matching for UNC prefix `"\\\\"` and drive suffix `"C:\\"`