# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/syn-2.0.110/tests/test_shebang.rs
@source-hash: 9bc24b1ee2947b06
@generated: 2026-02-09T18:12:04Z

**Purpose**: Test suite for shebang parsing functionality in the `syn` crate, verifying that the parser correctly handles Unix shebang lines in Rust source files.

**Test Functions**:
- `test_basic` (L12-34): Tests parsing of a valid shebang (`#!/usr/bin/env rustx`) followed by a simple main function. Validates that the parsed `File` struct correctly captures the shebang in the `shebang` field while parsing the rest of the code normally.
- `test_comment` (L36-73): Tests edge case where a shebang-like line (`#!//am/i/a/comment`) is treated as a comment rather than a shebang, ensuring the parser doesn't incorrectly identify it as a shebang when followed by attributes and code.

**Dependencies**:
- `syn` crate: Core dependency for parsing Rust syntax
- `snapshot` module (L8): Custom macro for snapshot testing, used to compare parsed AST structures against expected output
- `debug` module (L10): Supporting debug utilities

**Test Methodology**: Uses snapshot testing pattern with the `snapshot!` macro to compare actual parsed AST output against expected serialized representations. Tests cover both positive case (valid shebang) and edge case (shebang-like comment).

**Key Validation Points**:
- Shebang detection and preservation in `File.shebang` field
- Proper parsing of code following shebang lines
- Distinction between actual shebangs and shebang-like comments
- AST structure integrity with various syntax elements (functions, attributes, visibility, signatures)

**Architectural Pattern**: Standard Rust test module using `#[test]` functions with comprehensive AST snapshot comparisons to ensure parsing correctness across different shebang scenarios.